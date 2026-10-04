<?php
// The query function for lists (docs/default-templates.md, "The split inside the client"): one
// parameter set in, one page of items out. It reads the index table's search columns, which the
// store copies from the universal names on every write (includes/store.php), and never a CRM
// field. Filters are the site's decisions: a status id a page names is compared, never judged.

declare(strict_types=1);

const CORE_CLIENT_PER_PAGE = 10;

/**
 * The WHERE of the list query for one parameter set, over the index as `i` joined to the posts as
 * `p`: the condition and its arguments, for `core_client_query` and for the places the search box
 * offers (includes/place-search.php), so both read every parameter the same way.
 *
 * @param array<string, mixed> $params
 * @return array{0: string, 1: list<mixed>}
 */
function core_client_query_condition(array $params): array
{
    global $wpdb;
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
    $q = trim((string) (($params['q'] ?? '') !== '' ? $params['q'] : ($params['area'] ?? '')));
    if ($q !== '') {
        $prefix = $wpdb->esc_like($q) . '%';
        $clauses = ['i.street LIKE %s', 'i.area_name LIKE %s', 'i.city LIKE %s'];
        array_push($args, $prefix, $prefix, $prefix);
        foreach (core_client_place_codes($q) as $code) {
            $clauses[] = 'i.county_municipality_code LIKE %s';
            $args[] = $code . '%';
        }
        $where[] = '(' . implode(' OR ', $clauses) . ')';
    }
    $places = [];
    foreach (core_client_query_list($params['lkf'] ?? null) as $code) {
        if (preg_match('/^(\d{2}|\d{4}|\d{6})$/', $code) === 1) {
            $places[] = 'i.county_municipality_code LIKE %s';
            $args[] = $code . '%';
        }
    }
    $areas = core_client_query_list($params['areas'] ?? null);
    if ($areas !== []) {
        $places[] = core_client_query_in_areas($areas);
        array_push($args, ...$areas);
    }
    if ($places !== []) {
        $where[] = '(' . implode(' OR ', $places) . ')';
    }
    $agents = core_client_query_list($params['agent'] ?? null);
    if ($agents !== []) {
        $where[] = core_client_query_in_list('i.agent_ids', $agents);
        array_push($args, ...core_client_query_list_args($agents));
    }
    $offices = core_client_query_list($params['office'] ?? null);
    if ($offices !== [] && $entity === 'agent') {
        $where[] = core_client_query_in_list('i.office_ids', $offices);
        array_push($args, ...core_client_query_list_args($offices));
    } elseif ($offices !== []) {
        $where[] = 'i.office_id IN (' . implode(',', array_fill(0, count($offices), '%s')) . ')';
        array_push($args, ...$offices);
    }
    $area_ids = core_client_query_list($params['area_id'] ?? null);
    if ($area_ids !== []) {
        $where[] = core_client_query_in_areas($area_ids);
        array_push($args, ...$area_ids);
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

    return [implode(' AND ', $where), $args];
}

/**
 * @param array<string, mixed> $params
 *   entity          property (default), agent, office, area, association, project
 *   status          ids, comma-separated or a list: `status.id` in; `for_sale`, `coming` and `sold`
 *                   stand for the ids the site named on its settings page (core_client_statuses)
 *   type, tenure    ids the same way: `type.id`, `tenure.id` in
 *   max_price, max_living_space   at most this
 *   min_price, min_living_space, min_rooms   at least this
 *   q               free text: the street, the area name or the postal town begins with it, or it begins
 *                   the name of a kommun or a län (municipalities.php turns the name into codes). `area`
 *                   is the parameter's old name and stands for `q` until the next release (docs/search.md)
 *   lkf             codes of two, four or six digits, comma-separated or a list: the home's code begins with one
 *   areas           area ids the visitor chose: the home is in one of them (includes/areas.php). `areas` and
 *                   `lkf` are one group, "any of these places"; everything else narrows it
 *   agent, office, area_id   ids, comma-separated or a list, "show only from these": the items belong
 *                   to any of these agents (a home has one or two, both are checked), offices or areas
 *   project, association   the id of the project or association the items belong to
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
    [$condition, $args] = core_client_query_condition($params);
    $per_page = max(1, (int) ($params['per_page'] ?? CORE_CLIENT_PER_PAGE));
    $page = max(1, (int) ($params['page'] ?? 1));
    $order = core_client_query_order((string) ($params['sort'] ?? ''), $entity);

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
 * `(column LIKE %s OR …)`, one per id, for a column that holds ids as `,one,two,` (a home's agents,
 * an agent's offices); the arguments come from `core_client_query_list_args`.
 *
 * @param list<string> $ids
 */
function core_client_query_in_list(string $column, array $ids): string
{
    return '(' . implode(' OR ', array_fill(0, count($ids), "$column LIKE %s")) . ')';
}

/**
 * @param list<string> $ids
 * @return list<string>
 */
function core_client_query_list_args(array $ids): array
{
    global $wpdb;
    return array_map(fn (string $id): string => '%,' . $wpdb->esc_like($id) . ',%', $ids);
}

/**
 * The homes the link table puts in any of the areas (includes/areas.php).
 *
 * @param list<string> $area_ids
 */
function core_client_query_in_areas(array $area_ids): string
{
    return 'i.post_id IN (SELECT l.post_id FROM ' . core_client_links_table() . ' l WHERE l.area_id IN (' . implode(',', array_fill(0, count($area_ids), '%s')) . '))';
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
