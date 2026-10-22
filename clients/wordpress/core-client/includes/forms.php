<?php
// The forms (docs/forms.md, "Built 2026-10-06: the first version"; questions 150 a and 155): the
// plugin's two receivers on the WordPress API, one that passes a filled form on and one that reads
// a viewing's times, and the bot check's public key, which the theme renders the challenge with.
// The theme draws the forms in the page and talks only to this site's own server; the receivers
// call Core with the token the site already syncs with, over Core's server door, and hand Core's
// answer back as it came. The token never reaches the page, and nothing in a form decides
// anything here. Since 2026-10-19 (docs/forms.md, "Built 2026-10-19") the site keeps every form it
// sends, with the visitor's details and the outcome, for 30 days on its page "Formulär"
// (includes/forms-page.php), which also holds the switch that turns the forms on, and a form that
// does not reach Core is tried twice more (question 166).

declare(strict_types=1);

add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/forms', [
        'methods' => 'POST',
        // A visitor's form: Core authenticates the site, by the token this server adds; the visitor has no account.
        'permission_callback' => '__return_true',
        'callback' => 'core_client_forms_receive',
    ]);
    register_rest_route('core/v1', '/forms/slots', [
        'methods' => 'GET',
        // The booking window's times: as public as the home's page; Core refuses a home that is not this site's tenant's.
        'permission_callback' => '__return_true',
        'callback' => 'core_client_forms_slots',
    ]);
});

/** How long the site keeps a form it sent, delivered or not, with the visitor's details (160 a). */
const CORE_CLIENT_FORMS_KEPT_DAYS = 30;

/** The table of the forms the site sent (its page "Formulär"). */
function core_client_forms_table(): string
{
    global $wpdb;
    return $wpdb->prefix . 'core_forms';
}

/** Whether this site's forms are on (its page "Formulär"); on until someone turns them off (146, item 2). */
function core_client_forms_on(): bool
{
    return get_option('core_client_forms_on', '1') !== '0';
}

/**
 * What the step "Söker du bostad?" takes from a home (docs/forms.md, the whitelisted fields): its
 * rooms and living space, which the form window prefills with the closest whitelisted value below,
 * and its areas and kommun code, which go with the search profile unseen: every area the site
 * links the home to, by its name and kommun code. As stored; nothing is decided from a value.
 *
 * @param array<string, mixed> $item the home as Core delivered it
 * @return array{rooms: float|int|null, living_space: float|int|null, areas: list<array{id: string, name: string, county_municipality_code: string|null}>, county_municipality_code: string|null}
 */
function core_client_form_wishes(int $post_id, array $item): array
{
    global $wpdb;
    $links = core_client_links_table();
    $areas = [];
    foreach ($wpdb->get_col($wpdb->prepare("SELECT area_id FROM $links WHERE post_id = %d ORDER BY area_id", $post_id)) as $area_id) {
        ['name' => $name, 'code' => $code] = core_client_area_named((string) $area_id);
        $areas[] = ['id' => (string) $area_id, 'name' => $name !== '' ? $name : (string) $area_id, 'county_municipality_code' => $code];
    }
    $number = static fn (mixed $value): float|int|null => is_int($value) || is_float($value) ? $value : null;
    $code = $item['address']['county_municipality_code'] ?? null;
    return [
        'rooms' => $number($item['rooms'] ?? null),
        'living_space' => $number($item['living_space'] ?? null),
        'areas' => $areas,
        'county_municipality_code' => is_string($code) && $code !== '' ? $code : null,
    ];
}

/**
 * Pass a filled form on to Core and answer as Core answered. The body is the universal submission
 * the theme built (schemas/submission.v1.json): Core checks it against the schema, finds the
 * tenant's connection from the token and refuses a home that is not the tenant's; this function
 * decides nothing from it. The bot check's proof the window earned goes along as it came, and
 * Core verifies it. 200 delivered, 409 refused with the reason, 429 too many, else failed
 * (docs/forms.md, "Core's part"). The form and the answer are kept for the page "Formulär".
 */
function core_client_forms_receive(WP_REST_Request $request): WP_REST_Response
{
    // The body goes on as it came, once it is a JSON object: decoded and encoded again, an empty
    // object (the source's UTM tags on a page without any) would turn into an empty list.
    $body = $request->get_body();
    $form = json_decode($body);
    if (!($form instanceof stdClass)) {
        return new WP_REST_Response(['error' => 'the body is not a form'], 400);
    }
    if (!core_client_forms_on()) {
        // A page cached while the forms were on.
        $answer = new WP_REST_Response(['status' => 'failed', 'error' => 'this site\'s forms are off'], 503);
    } else {
        $human = trim((string) $request->get_header('x_core_human'));
        $answer = core_client_forms_send($body, $human !== '' ? ['X-Core-Human' => $human] : []);
    }
    core_client_forms_keep($form, $body, $answer);
    return $answer;
}

/**
 * One form to Core, as the window sent it, with the headers given (the window's proof). When Core
 * did not answer (no connection, or a gateway's error while Core restarts), the same form, under
 * the same id, is tried twice more, after 1 s and 3 s, and none starts later than 10 s after the
 * first (166): Core answers an id it already holds with its first answer, so nothing goes twice.
 */
function core_client_forms_send(string $body, array $extra): WP_REST_Response
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return new WP_REST_Response(['status' => 'failed', 'error' => 'this site is not linked to Core'], 503);
    }
    $headers = core_client_forms_headers($settings) + $extra;
    $headers['Content-Type'] = 'application/json';
    // Which site sent it, as on a pull, so the form's events show on this site's row in Core.
    $headers['X-Core-Site'] = rest_url('core/v1/bell');
    $started = microtime(true);
    foreach ([1, 3, null] as $wait) {
        $response = wp_remote_post($settings['url'] . '/v1/submissions', [
            'timeout' => 25, // Core itself waits at most 20 s for the CRM
            'headers' => $headers,
            'body' => $body,
        ]);
        if ($wait === null || !core_client_forms_unanswered($response) || microtime(true) - $started + $wait > 10) {
            break;
        }
        sleep($wait);
    }
    return core_client_forms_answer($response, 'a form did not reach Core');
}

/** True when Core gave no answer of its own: no connection, or a gateway's 5xx without Core's JSON. */
function core_client_forms_unanswered(array|WP_Error $response): bool
{
    if ($response instanceof WP_Error) {
        return true;
    }
    $status = (int) wp_remote_retrieve_response_code($response);
    return $status >= 500 && !is_array(json_decode((string) wp_remote_retrieve_body($response), true));
}

/**
 * Keep a form and its outcome for the page "Formulär", or the outcome of a form kept already. Not
 * kept: what Core refused before it judged a form, which is a program's, not a visitor's (no or a
 * failed bot proof, the limit per minute, a body that is no form). Forms older than 30 days go.
 */
function core_client_forms_keep(stdClass $form, string $body, WP_REST_Response $answer): void
{
    global $wpdb;
    $id = is_string($form->id ?? null) ? strtolower($form->id) : '';
    $status = $answer->get_status();
    $data = (array) $answer->get_data();
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id)
        || $status === 403 || $status === 429 || ($status === 400 && !isset($data['id']))) {
        return;
    }
    [$outcome, $said] = core_client_forms_outcome($status, $data);
    $table = core_client_forms_table();
    $now = current_time('mysql', true);
    $wpdb->query($wpdb->prepare(
        "INSERT INTO $table (id, sent_at, kind, body, outcome, said)
         VALUES (%s, %s, %s, %s, %s, %s)
         ON DUPLICATE KEY UPDATE outcome = VALUES(outcome), said = VALUES(said)",
        $id,
        $now,
        is_string($form->kind ?? null) ? substr($form->kind, 0, 20) : '',
        $body,
        $outcome,
        $said,
    ));
    core_client_forms_purge();
}

/**
 * Delete the forms kept longer than 30 days, with the visitors' details: on every form kept, when
 * the page "Formulär" opens, and with the 15 minute backstop (includes/schedule.php), so none
 * outstays its time on a site that gets no forms.
 */
function core_client_forms_purge(): void
{
    global $wpdb;
    $table = core_client_forms_table();
    $wpdb->query($wpdb->prepare(
        "DELETE FROM $table WHERE sent_at < %s",
        gmdate('Y-m-d H:i:s', time() - CORE_CLIENT_FORMS_KEPT_DAYS * DAY_IN_SECONDS),
    ));
}

/**
 * What became of a form, from the answer the window got: `delivered`, `held` (a test run that
 * stopped before the CRM), `refused` by the CRM, or not sent: `crm` (the CRM did not answer),
 * `check` (the bot check could not run), `unreachable` (Core did not answer), `unlinked`, `off`
 * (the site's forms are off) and `rejected` (Core did not take it). With what was said, if anything.
 *
 * @param array<string, mixed> $data
 * @return array{0: string, 1: string}
 */
function core_client_forms_outcome(int $status, array $data): array
{
    $error = is_string($data['error'] ?? null) ? $data['error'] : '';
    if ($status === 200) {
        return ['delivered', ''];
    }
    if ($status === 409) {
        return [($data['held'] ?? false) === true ? 'held' : 'refused', (string) ($data['reason'] ?? '')];
    }
    if (($data['bot_check'] ?? '') === 'broken') {
        return ['check', $error];
    }
    if ($error === 'this site is not linked to Core') {
        return ['unlinked', ''];
    }
    if ($error === 'this site\'s forms are off') {
        return ['off', ''];
    }
    if ($status === 502 && ($data['status'] ?? '') === 'failed' && isset($data['id'])) {
        return ['crm', ''];
    }
    if ($status >= 500 && $status !== 501) {
        return ['unreachable', $error];
    }
    return ['rejected', $error];
}

/**
 * A viewing's times for the booking window, read from Core as the CRM has them now. The home is
 * named as the page's button names it, by its connection and its id; Core refuses one that is not
 * this site's tenant's. Core's answer goes back as it came.
 */
function core_client_forms_slots(WP_REST_Request $request): WP_REST_Response
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return new WP_REST_Response(['error' => 'this site is not linked to Core'], 503);
    }
    $query = http_build_query([
        'connection_id' => (string) $request->get_param('connection_id'),
        'remote_id' => (string) $request->get_param('remote_id'),
    ]);
    $response = wp_remote_get($settings['url'] . '/v1/submissions/slots?' . $query, [
        'timeout' => 25,
        'headers' => core_client_forms_headers($settings),
    ]);
    return core_client_forms_answer($response, 'a viewing\'s times did not come from Core');
}

/** What every call to Core's forms addresses carries: the site's token and the plugin's version. */
function core_client_forms_headers(array $settings): array
{
    return [
        'Authorization' => 'Bearer ' . $settings['token'],
        'X-Core-Client' => 'wordpress/' . CORE_CLIENT_VERSION,
    ];
}

/** Core's status and answer as they came; a call that did not reach Core is a failure, reported. */
function core_client_forms_answer(array|WP_Error $response, string $failure): WP_REST_Response
{
    if ($response instanceof WP_Error) {
        // The network, never the form: no name, phone or e-mail is reported.
        core_client_report($failure, ['where' => 'forms.php', 'detail' => $response->get_error_message()]);
        return new WP_REST_Response(['status' => 'failed'], 502);
    }
    $status = (int) wp_remote_retrieve_response_code($response);
    $answer = json_decode((string) wp_remote_retrieve_body($response), true);
    if (!is_array($answer)) {
        // Not Core's answer (a gateway's page, or none), so never a "sent": a failure, reported.
        core_client_report($failure, ['where' => 'forms.php', 'detail' => 'HTTP ' . $status . ' without Core\'s answer']);
        return new WP_REST_Response(['status' => 'failed'], $status >= 500 ? $status : 502);
    }
    return new WP_REST_Response($answer, $status > 0 ? $status : 502);
}

/**
 * The bot check's public key for the form window, as Core gives it (`provider` and `site_key`),
 * or null while Core has none or cannot be reached. Asked of Core once an hour, and a failed read
 * again after five minutes, so a page waits on Core at most once in that time.
 *
 * @return array{provider: string, site_key: string}|null
 */
function core_client_human_check(): ?array
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return null;
    }
    // Kept per Core and token, so a site linked anew reads the key afresh.
    $transient = 'core_client_human_check_' . md5($settings['url'] . '|' . $settings['token']);
    $cached = get_transient($transient);
    if (is_array($cached)) {
        return $cached['human'] ?? null;
    }
    $response = wp_remote_get($settings['url'] . '/v1/submissions/bot-check', [
        'timeout' => 5,
        'headers' => core_client_forms_headers($settings),
    ]);
    $read = !($response instanceof WP_Error) && (int) wp_remote_retrieve_response_code($response) === 200;
    $answer = $read ? json_decode((string) wp_remote_retrieve_body($response), true) : null;
    $given = is_array($answer) && is_array($answer['human'] ?? null) ? $answer['human'] : null;
    $human = $given !== null && is_string($given['provider'] ?? null) && is_string($given['site_key'] ?? null)
        ? ['provider' => $given['provider'], 'site_key' => $given['site_key']]
        : null;
    set_transient($transient, ['human' => $human], is_array($answer) ? HOUR_IN_SECONDS : 5 * MINUTE_IN_SECONDS);
    return $human;
}
