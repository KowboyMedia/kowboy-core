<?php
// The query function for lists (docs/default-templates.md, "The split inside the client"): one
// parameter set in, one page of items out. It reads the index table's search columns, which the
// store copies from the universal names on every write (includes/store.php), and never a CRM
// field. Filters are the site's decisions: a status id a page names is compared, never judged.

declare(strict_types=1);

const CORE_CLIENT_PER_PAGE = 10;

/**
 * @param array<string, mixed> $params
 *   entity          property (default), agent, office, area, association, project
 *   status          ids, comma-separated or a list: `status.id` in; `for_sale`, `coming` and `sold`
 *                   stand for the ids the site named on its settings page (core_client_statuses)
 *   type, tenure    ids the same way: `type.id`, `tenure.id` in
 *   max_price, max_living_space   at most this
 *   min_price, min_living_space, min_rooms   at least this
 *   area            free text against the area name, the city and the street
 *   agent, office, project, area_id, association   the id of the agent, office, project, area or association the items belong to
 *   include_project_homes         properties that name a project are otherwise kept out (question 55)
 *   include_hidden                agents the CRM keeps out of the staff list (on the record or an office) are otherwise kept out
 *   sort            newest (default for properties), sold, price_asc, price_desc, updated, name (default
 *                   otherwise: the CRM's order where it gives one, an agent's place in the staff list, then the name)
 *   per_page, page  paging, from page 1
 * @return array{items: list<array{post_id: int, item: array<string, mixed>}>, total: int, has_more: bool, page: int, per_page: int}
 */
function core_client_query(array $params): array
{
    global $wpdb;
    $index = core_client_index_table();
    $entity = (string) ($params['entity'] ?? 'property');
    // A draft (the site's own records, includes/site-records.php) is not on the site; a CRM record is always published.
    $where = ['i.datatype = %s', "p.post_status = 'publish'"];
    $args = [$entity];

    foreach (['status' => 'status_id', 'type' => 'type_id', 'tenure' => 'tenure_id'] as $param => $column) {
        $values = core_client_query_list($params[$param] ?? null);
        if ($param === 'status') {
            $values = core_client_status_ids($values);
        }
        if ($values !== []) {
            $where[] = "i.$column IN (" . implode(',', array_fill(0, count($values), '%s')) . ')';
            array_push($args, ...$values);
        }
    }
    foreach (['max_price' => 'i.price <= %f', 'min_price' => 'i.price >= %f', 'max_living_space' => 'i.living_space <= %f', 'min_living_space' => 'i.living_space >= %f', 'min_rooms' => 'i.rooms >= %f'] as $param => $clause) {
        $value = $params[$param] ?? null;
        if (is_numeric($value) && (float) $value > 0) {
            $where[] = $clause;
            $args[] = (float) $value;
        }
    }
    $area = trim((string) ($params['area'] ?? ''));
    if ($area !== '') {
        $like = '%' . $wpdb->esc_like($area) . '%';
        $where[] = '(i.area_name LIKE %s OR i.city LIKE %s OR i.street LIKE %s)';
        array_push($args, $like, $like, $like);
    }
    $agent = trim((string) ($params['agent'] ?? ''));
    if ($agent !== '') {
        $where[] = 'i.agent_ids LIKE %s';
        $args[] = '%,' . $wpdb->esc_like($agent) . ',%';
    }
    $office = trim((string) ($params['office'] ?? ''));
    if ($office !== '' && $entity === 'agent') {
        $where[] = 'i.office_ids LIKE %s';
        $args[] = '%,' . $wpdb->esc_like($office) . ',%';
    } elseif ($office !== '') {
        $where[] = 'i.office_id = %s';
        $args[] = $office;
    }
    $area_id = trim((string) ($params['area_id'] ?? ''));
    if ($area_id !== '') {
        $where[] = 'i.area_id = %s';
        $args[] = $area_id;
    }
    $association = trim((string) ($params['association'] ?? ''));
    if ($association !== '') {
        $where[] = 'i.association_id = %s';
        $args[] = $association;
    }
    $project = trim((string) ($params['project'] ?? ''));
    if ($project !== '') {
        $where[] = 'i.project_id = %s';
        $args[] = $project;
    } elseif ($entity === 'property' && empty($params['include_project_homes'])) {
        $where[] = 'i.project_id IS NULL';
    }
    if (empty($params['include_hidden'])) {
        $where[] = 'i.listed = 1';
    }
    // A datatype the site does not publish (the settings page) lists nothing.
    if (!core_client_published($entity)) {
        $where[] = '1 = 0';
    }

    $per_page = max(1, (int) ($params['per_page'] ?? CORE_CLIENT_PER_PAGE));
    $page = max(1, (int) ($params['page'] ?? 1));
    $order = core_client_query_order((string) ($params['sort'] ?? ''), $entity);
    $condition = implode(' AND ', $where);

    $total = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $index i JOIN {$wpdb->posts} p ON p.ID = i.post_id WHERE $condition",
        ...$args,
    ));
    $rows = $wpdb->get_col($wpdb->prepare(
        "SELECT i.post_id FROM $index i JOIN {$wpdb->posts} p ON p.ID = i.post_id WHERE $condition ORDER BY $order LIMIT %d OFFSET %d",
        ...[...$args, $per_page, ($page - 1) * $per_page],
    ));
    $items = [];
    core_client_prime(array_map('intval', $rows));
    foreach ($rows as $post_id) {
        $item = core_client_item((int) $post_id);
        if ($item !== null) {
            $items[] = ['post_id' => (int) $post_id, 'item' => $item];
        }
    }
    return [
        'items' => $items,
        'total' => $total,
        'has_more' => $page * $per_page < $total,
        'page' => $page,
        'per_page' => $per_page,
    ];
}

/**
 * A comma-separated string or a list, as a list of non-empty strings.
 *
 * @return list<string>
 */
function core_client_query_list(mixed $value): array
{
    $values = is_array($value) ? $value : explode(',', (string) $value);
    return array_values(array_filter(array_map(fn ($one): string => trim((string) $one), $values), fn (string $one): bool => $one !== ''));
}

function core_client_query_order(string $sort, string $entity): string
{
    return match ($sort !== '' ? $sort : ($entity === 'property' ? 'newest' : 'name')) {
        'sold' => 'i.sold_at DESC, i.remote_updated_at DESC',
        'price_asc' => 'i.price ASC, i.post_id ASC',
        'price_desc' => 'i.price DESC, i.post_id ASC',
        'updated' => 'i.remote_updated_at DESC, i.post_id ASC',
        // The CRM's own order first (an agent's place in the staff list), the name where it gives none.
        'name' => 'ISNULL(i.sort_order), i.sort_order ASC, i.sort_name ASC, i.post_id ASC',
        default => 'i.published_at DESC, i.remote_updated_at DESC, i.post_id ASC',
    };
}

/**
 * The status ids a site named for each of its three lists (settings page): which of the CRM's
 * ids mean "for sale", "coming" and "sold" on this site. Empty until the site names them.
 *
 * @return array{for_sale: list<string>, coming: list<string>, sold: list<string>}
 */
function core_client_statuses(): array
{
    return [
        'for_sale' => core_client_query_list(get_option('core_client_status_for_sale', '')),
        'coming' => core_client_query_list(get_option('core_client_status_coming', '')),
        'sold' => core_client_query_list(get_option('core_client_status_sold', '')),
    ];
}

/**
 * Status values with the three names expanded to the site's ids; a CRM id passes through.
 *
 * @param list<string> $values
 * @return list<string>
 */
function core_client_status_ids(array $values): array
{
    $statuses = core_client_statuses();
    $ids = [];
    foreach ($values as $value) {
        array_push($ids, ...($statuses[$value] ?? [$value]));
    }
    return array_values(array_unique($ids));
}
