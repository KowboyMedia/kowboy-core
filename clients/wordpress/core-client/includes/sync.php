<?php
// The subscriber sync loop, as SRS §8 describes it: a cursor per datatype, the hash as the skip
// test, tombstones delete, forcerefresh rewrites everything, resync_required rebuilds. Every page
// and its cursor commit together. One sync runs at a time; a bell arriving mid-run leaves a note
// that the running sync works through before it lets go of the lock.

declare(strict_types=1);

const CORE_CLIENT_LOCK = 'core_client_sync';

/**
 * Leave the note, take the lock, work through every note, let go. Whoever holds the lock runs.
 *
 * @return array<string, mixed> the status afterwards
 */
function core_client_sync(string $kind = 'delta'): array
{
    global $wpdb;
    core_client_leave_note($kind === 'forcerefresh' ? 'forcerefresh' : 'delta');
    while ($wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)', CORE_CLIENT_LOCK)) === '1') {
        try {
            while (($next = core_client_take_note()) !== null) {
                core_client_run_once($next);
            }
        } finally {
            $wpdb->query($wpdb->prepare('SELECT RELEASE_LOCK(%s)', CORE_CLIENT_LOCK));
        }
        // A note left between the last look and the unlock is someone's to run: ours if still there.
        if (core_client_state('pending') === null) {
            break;
        }
    }
    return core_client_status();
}

function core_client_run_once(string $kind): void
{
    core_client_put_state('running_since', gmdate('c'));
    core_client_put_state('last_kind', $kind);
    try {
        if ($kind === 'forcerefresh') {
            core_client_rebuild();
        } else {
            foreach (core_client_datatypes() as $datatype) {
                if (core_client_pull($datatype, false) === 'resync_required') {
                    core_client_rebuild();
                    break;
                }
            }
        }
        core_client_put_state('last_success_at', gmdate('c'));
        core_client_put_state('last_error', null);
    } catch (Throwable $error) {
        // The cursor moved with every page that succeeded; the next run carries on from there.
        core_client_put_state('last_error', $error->getMessage());
        core_client_report('sync failed', ['kind' => $kind, 'detail' => $error->getMessage()]);
    } finally {
        // One transaction, so "not running" and the run count are never seen half-written.
        global $wpdb;
        $wpdb->query('START TRANSACTION');
        core_client_put_state('running_since', null);
        core_client_put_state('last_finished_at', gmdate('c'));
        core_client_put_state('runs', (string) ((int) core_client_state('runs') + 1));
        $wpdb->query('COMMIT');
    }
}

/**
 * Page through /v1/changes from the stored cursor (or from 0 when rewriting everything). Each
 * page and its cursor commit together, so a failure never leaves the cursor ahead of the data.
 */
function core_client_pull(string $datatype, bool $rewrite_all): string
{
    global $wpdb;
    $after = $rewrite_all ? 0 : (int) (core_client_state("after.$datatype") ?? '0');
    for (;;) {
        $page = core_client_fetch_page($datatype, $after);
        if ($page === null) {
            return 'resync_required';
        }
        $results = [];
        $wpdb->query('START TRANSACTION');
        try {
            foreach ($page->items as $item) {
                $results[] = core_client_write($datatype, $item, $rewrite_all);
            }
            core_client_put_state("after.$datatype", (string) $page->next_after);
            $wpdb->query('COMMIT');
        } catch (Throwable $error) {
            $wpdb->query('ROLLBACK');
            // The page was rolled back: every record on it failed here, and Core is told so.
            $failed = [];
            foreach ($page->items as $item) {
                $failed[] = core_client_outcome($datatype, $item, 'failed', $error->getMessage());
            }
            core_client_report_applied($failed);
            throw $error;
        }
        core_client_report_applied($results);
        $after = (int) $page->next_after;
        if (!$page->has_more) {
            return 'ok';
        }
    }
}

/** One page from Core, or null for 409 resync_required (strategy §7). Anything else that is not a page throws. */
function core_client_fetch_page(string $datatype, int $after): ?object
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        throw new RuntimeException('the Core URL and tenant token are not set');
    }
    $response = wp_remote_get(
        $settings['url'] . '/v1/changes?' . http_build_query(['datatype' => $datatype, 'after' => $after]),
        [
            'timeout' => 30,
            'headers' => [
                'Authorization' => 'Bearer ' . $settings['token'],
                'X-Core-Client' => 'wordpress/' . CORE_CLIENT_VERSION,
            ],
        ],
    );
    if (is_wp_error($response)) {
        throw new RuntimeException('pull failed: ' . $response->get_error_message());
    }
    $status = wp_remote_retrieve_response_code($response);
    if ($status === 409) {
        return null;
    }
    if ($status === 401) {
        throw new RuntimeException('the licence is not active: Core refused the token (http 401)');
    }
    if ($status !== 200) {
        throw new RuntimeException("pull failed: http $status");
    }
    // Decoded as objects, so `{}` and `[]` inside `data` survive the round trip into the meta key.
    $page = json_decode(wp_remote_retrieve_body($response));
    if (!is_object($page) || !isset($page->items) || !is_array($page->items) || !isset($page->next_after)) {
        throw new RuntimeException('pull failed: malformed page');
    }
    return $page;
}

/**
 * One item from a page: a tombstone deletes, anything else is upserted unless its hash is stored.
 * Returns what to tell Core about it (question 37), or null for an item too broken to name.
 *
 * @return array<string, mixed>|null
 */
function core_client_write(string $datatype, mixed $item, bool $rewrite_all): ?array
{
    if (!core_client_usable($item)) {
        // Skipped and reported, and the loop goes on (SRS §8 resilience).
        core_client_report('skipped an item this client cannot use', [
            'datatype' => $datatype,
            'connection_id' => is_object($item) ? ($item->connection_id ?? null) : null,
            'remote_id' => is_object($item) ? ($item->remote_id ?? null) : null,
            'seq' => is_object($item) ? ($item->seq ?? null) : null,
        ]);
        return core_client_outcome($datatype, $item, 'failed', 'this client cannot use the item');
    }
    if ($item->deleted === true) {
        core_client_delete_item($datatype, $item->connection_id, $item->remote_id);
        return core_client_outcome($datatype, $item, 'applied');
    }
    $existing = core_client_index_row($datatype, $item->connection_id, $item->remote_id);
    // The hash is the skip test: an item that has not changed is not rewritten (SRS §8).
    if ($rewrite_all || $existing === null || $existing->content_hash !== $item->content_hash) {
        core_client_upsert_item($datatype, $item, $existing);
    }
    return core_client_outcome($datatype, $item, 'applied');
}

/**
 * One line of the report to Core: which record, and whether this site applied it.
 *
 * @return array<string, mixed>|null
 */
function core_client_outcome(string $datatype, mixed $item, string $result, ?string $detail = null): ?array
{
    if (
        !is_object($item)
        || !is_string($item->connection_id ?? null) || $item->connection_id === ''
        || !is_string($item->remote_id ?? null) || $item->remote_id === ''
        || !is_int($item->seq ?? null)
    ) {
        return null;
    }
    $outcome = [
        'datatype' => $datatype,
        'connection_id' => $item->connection_id,
        'remote_id' => $item->remote_id,
        'seq' => $item->seq,
        'result' => $result,
    ];
    if ($detail !== null) {
        $outcome['detail'] = mb_substr($detail, 0, 1000);
    }
    return $outcome;
}

/**
 * Tell Core what this site applied and what it could not (POST /v1/applied, question 37), so a
 * record's timeline in Core runs to the site. A report that cannot be delivered is logged and
 * never stops a sync.
 *
 * @param array<int, array<string, mixed>|null> $outcomes
 */
function core_client_report_applied(array $outcomes): void
{
    $items = array_values(array_filter($outcomes, static fn ($outcome) => $outcome !== null));
    if ($items === []) {
        return;
    }
    $settings = core_client_settings();
    $response = wp_remote_post($settings['url'] . '/v1/applied', [
        'timeout' => 10,
        'headers' => [
            'Authorization' => 'Bearer ' . $settings['token'],
            'X-Core-Client' => 'wordpress/' . CORE_CLIENT_VERSION,
            'Content-Type' => 'application/json',
        ],
        'body' => wp_json_encode(['items' => $items]),
    ]);
    $status = is_wp_error($response) ? $response->get_error_message() : wp_remote_retrieve_response_code($response);
    if ($status !== 202) {
        core_client_report('the applied report was not taken', ['status' => $status, 'items' => count($items)]);
    }
}

function core_client_usable(mixed $item): bool
{
    return is_object($item)
        && is_string($item->connection_id ?? null) && $item->connection_id !== ''
        && is_string($item->remote_id ?? null) && $item->remote_id !== ''
        && (($item->deleted ?? false) === true || is_object($item->data ?? null));
}

/**
 * Pull everything from seq 0 and rewrite every item (forcerefresh, SRS §8), then drop what was
 * not seen, only once every page succeeded: the site keeps serving its old copy until then and is
 * never emptied (strategy §7). Also the answer to resync_required.
 */
function core_client_rebuild(): void
{
    global $wpdb;
    $started = (string) $wpdb->get_var('SELECT NOW(6)');
    foreach (core_client_datatypes() as $datatype) {
        if (core_client_pull($datatype, true) === 'resync_required') {
            throw new RuntimeException('resync required from seq 0');
        }
    }
    $index = core_client_index_table();
    $stale = $wpdb->get_results($wpdb->prepare("SELECT datatype, connection_id, remote_id FROM $index WHERE synced_at < %s", $started));
    foreach ($stale as $row) {
        core_client_delete_item($row->datatype, $row->connection_id, $row->remote_id);
    }
}

function core_client_state(string $name): ?string
{
    global $wpdb;
    $state = core_client_state_table();
    $value = $wpdb->get_var($wpdb->prepare("SELECT value FROM $state WHERE name = %s", $name));
    return is_string($value) ? $value : null;
}

function core_client_put_state(string $name, ?string $value): void
{
    global $wpdb;
    $state = core_client_state_table();
    if ($value === null) {
        $wpdb->delete($state, ['name' => $name]);
    } else {
        $wpdb->replace($state, ['name' => $name, 'value' => $value]);
    }
}

/** The note a bell leaves for whoever is syncing. forcerefresh outranks delta. */
function core_client_leave_note(string $kind): void
{
    global $wpdb;
    $state = core_client_state_table();
    $wpdb->query($wpdb->prepare(
        "INSERT INTO $state (name, value) VALUES ('pending', %s)
         ON DUPLICATE KEY UPDATE value = IF(value = 'forcerefresh', value, %s)",
        $kind,
        $kind,
    ));
}

/** Read and clear the note in one step, so two runners never work the same note. */
function core_client_take_note(): ?string
{
    global $wpdb;
    $state = core_client_state_table();
    $wpdb->query('START TRANSACTION');
    $value = $wpdb->get_var("SELECT value FROM $state WHERE name = 'pending' FOR UPDATE");
    if (is_string($value)) {
        $wpdb->delete($state, ['name' => 'pending']);
    }
    $wpdb->query('COMMIT');
    return is_string($value) ? $value : null;
}

/**
 * What an operator, the CLI and the settings page see.
 *
 * @return array<string, mixed>
 */
function core_client_status(): array
{
    global $wpdb;
    $index = core_client_index_table();
    $status = [
        'runs' => (int) core_client_state('runs'),
        'pending' => core_client_state('pending'),
        'running_since' => core_client_state('running_since'),
        'last_success_at' => core_client_state('last_success_at'),
        'last_finished_at' => core_client_state('last_finished_at'),
        'last_error' => core_client_state('last_error'),
        'notice' => core_client_notice(),
        'after' => [],
        'items' => [],
    ];
    foreach (core_client_datatypes() as $datatype) {
        $status['after'][$datatype] = (int) (core_client_state("after.$datatype") ?? '0');
        $status['items'][$datatype] = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $index WHERE datatype = %s", $datatype));
    }
    return $status;
}
