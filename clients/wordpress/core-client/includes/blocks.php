<?php
// The plugin's two list blocks (docs/search.md, "The blocks in the plugin"): "Bostäder" and
// "Mäklare", with the settings of the ask (which homes, how many, the filters, the place search,
// "show only from these" agents, areas and offices, and "show only with these" tags, as picks by
// name). They render through
// the one list function and the chosen set's views, so the look is the theme's or the set's.
// The editor side is one script (assets/editor.js) that builds every block's settings panel
// from the attributes' `control` keys and previews the block as the server renders it; a theme
// names the same script for its own blocks and appends their names to the list it serves.
// One small endpoint, for editors, lists the records a pick offers.

declare(strict_types=1);

/**
 * The block names the editor script serves: the plugin's, and the ones a theme or a set appends.
 *
 * @param list<string> $names
 */
function core_client_editor_blocks(array $names): void
{
    wp_add_inline_script(
        'core-client-editor',
        'window.coreClientBlocks = (window.coreClientBlocks || []).concat(' . wp_json_encode($names) . ');',
        'before',
    );
}

/**
 * The list settings the blocks share (the attributes of `blocks/<entity>-list/block.json`, with
 * their `control`, `label` and `help` keys), so a theme's own list block registers them merged
 * into its attributes and renders through `core_client_list_block`.
 *
 * @return array<string, array<string, mixed>>
 */
function core_client_list_attributes(string $entity): array
{
    $file = dirname(__DIR__) . "/blocks/$entity-list/block.json";
    $json = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    return is_array($json) && is_array($json['attributes'] ?? null) ? $json['attributes'] : [];
}

/**
 * The parameter set a list block hands the list function: the block's settings as the query's
 * parameters, the picks as "show only from these" lists, and, for a property list, the visitor's
 * own choices from the address (the filters, the place search), which never widen a restriction.
 * The shadow root is the site's setting, as for the shortcode, except in the editor's preview,
 * which cannot open one (a theme's wrapper passes `shadow` false itself, its stylesheet being on
 * the page).
 *
 * @param array<string, mixed> $attributes
 * @return array<string, mixed>
 */
function core_client_list_block_params(array $attributes, string $entity): array
{
    $ids = fn (mixed $list): string => implode(',', array_filter(is_array($list) ? array_map('strval', $list) : [], fn (string $id): bool => $id !== ''));
    $params = [
        'entity' => $entity,
        'title' => (string) ($attributes['title'] ?? ''),
        'lead' => (string) ($attributes['lead'] ?? ''),
    ];
    if (defined('REST_REQUEST') && REST_REQUEST) {
        $params['shadow'] = false;
    }
    foreach (['agents' => 'agent', 'offices' => 'office', 'areas' => 'area_id', 'tags' => 'tags'] as $attribute => $param) {
        $list = $ids($attributes[$attribute] ?? null);
        if ($list !== '') {
            $params[$param] = $list;
        }
    }
    if ($entity !== 'property') {
        return $params + ['per_page' => 100];
    }
    $params += [
        'status' => (string) ($attributes['status'] ?? 'for_sale,coming'),
        'per_page' => max(1, (int) ($attributes['perPage'] ?? 9)),
        'status_filter' => !empty($attributes['statusTabs']) ? '1' : '',
        'filters' => !empty($attributes['filters']) ? '1' : '',
        // Read by the search box of docs/search.md's session 3; carried from here so the box only has to draw.
        'place_search' => (string) ($attributes['placeSearch'] ?? 'none'),
    ];
    // The visitor's choices on the address, as the theme's list block took them: the filters and the place
    // (the status tabs work through the reload script, the block's own status standing here).
    return $params + array_intersect_key($_GET, array_flip(['status', 'max_price', 'min_living_space', 'min_rooms', 'q', 'area', 'lkf', 'areas', 'tags']));
}

/**
 * One list block's markup: the list function with the block's parameter set, `$extra` on top
 * (a theme's wrapper asks for `part` = `cards` to lay the cards out itself).
 *
 * @param array<string, mixed> $attributes
 * @param array<string, mixed> $extra
 */
function core_client_list_block(array $attributes, string $entity, array $extra = []): string
{
    return core_client_list(array_merge(core_client_list_block_params($attributes, $entity), $extra))['html'];
}

add_action('init', function (): void {
    wp_register_script(
        'core-client-editor',
        plugins_url('assets/editor.js', CORE_CLIENT_FILE),
        ['wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-server-side-render', 'wp-api-fetch'],
        CORE_CLIENT_VERSION,
        true,
    );
    $names = [];
    foreach (['property-list', 'agent-list'] as $block) {
        $type = register_block_type(dirname(__DIR__) . "/blocks/$block");
        if ($type instanceof WP_Block_Type) {
            $names[] = $type->name;
        }
    }
    core_client_editor_blocks($names);
}, 5);

add_filter('block_categories_all', function (array $categories): array {
    $categories[] = ['slug' => 'core-client', 'title' => 'Kowboy Core'];
    return $categories;
});

/**
 * A theme's or a set's own list block: `"coreClientList": "property"` (or `agent`) in its
 * block.json registers the plugin's list settings merged into the block's own attributes, so its
 * render file can call `core_client_list_block` and the editor shows every setting.
 *
 * @param array<string, mixed> $metadata
 * @return array<string, mixed>
 */
add_filter('block_type_metadata', function (array $metadata): array {
    if (is_string($metadata['coreClientList'] ?? null)) {
        $metadata['attributes'] = core_client_list_attributes($metadata['coreClientList']) + (array) ($metadata['attributes'] ?? []);
    }
    return $metadata;
});

/**
 * What a pick offers: every agent, office or area the site holds, listed or hidden (the editor
 * chooses), as an id and a label that names it apart from its namesakes: an area with its
 * kommun, an agent with an office, an office with its town; the id when two labels still match.
 * For `tag`, every tag the site's homes carry (core_client_tag_picks).
 *
 * @return list<array{id: string, label: string}>
 */
function core_client_picks(string $entity): array
{
    if ($entity === 'tag') {
        return core_client_tag_picks();
    }
    if (!in_array($entity, ['agent', 'office', 'area'], true)) {
        return [];
    }
    $offices = $entity === 'agent' ? core_client_office_names() : [];
    $picks = [];
    foreach (core_client_query(['entity' => $entity, 'include_hidden' => '1', 'per_page' => 5000, 'sort' => 'name'])['items'] as $row) {
        $id = (string) ($row['item']['id'] ?? '');
        if ($id !== '') {
            $picks[] = ['id' => $id, 'label' => core_client_pick_label($entity, $row['item'], $offices)];
        }
    }
    return core_client_unique_pick_labels($picks);
}

/**
 * The picks with a label that occurs more than once given the id in brackets, since the editor's
 * token field works on labels (assets/editor.js).
 *
 * @param list<array{id: string, label: string}> $picks
 * @return list<array{id: string, label: string}>
 */
function core_client_unique_pick_labels(array $picks): array
{
    $counts = array_count_values(array_column($picks, 'label'));
    return array_map(
        fn (array $pick): array => $counts[$pick['label']] > 1 ? ['id' => $pick['id'], 'label' => $pick['label'] . ' (' . $pick['id'] . ')'] : $pick,
        $picks,
    );
}

/**
 * Every tag the site's homes carry, sold and unlisted ones too, as the query's token (`<type
 * id>:<name>`, the index column's) and a label of the type's name and the tag's ("Försäljningssätt ·
 * Underhand"), by label. The type's name is read from one home that carries the type, since the
 * index holds the id alone; the words are the CRM's, nothing is judged (question 143 a).
 *
 * @return list<array{id: string, label: string}>
 */
function core_client_tag_picks(): array
{
    global $wpdb;
    $index = core_client_index_table();
    $tokens = [];
    foreach ($wpdb->get_col("SELECT DISTINCT tags FROM $index WHERE datatype = 'property' AND tags IS NOT NULL") ?: [] as $cell) {
        foreach (explode(',', trim((string) $cell, ',')) as $token) {
            if ($token !== '' && str_contains($token, ':')) {
                $tokens[$token] = true;
            }
        }
    }
    $type_names = [];
    $picks = [];
    foreach (array_keys($tokens) as $token) {
        [$type_id, $name] = explode(':', $token, 2);
        if (!array_key_exists($type_id, $type_names)) {
            $type_names[$type_id] = core_client_tag_type_name($type_id);
        }
        $type_name = $type_names[$type_id];
        $picks[] = ['id' => $token, 'label' => $type_name !== null && $type_name !== '' ? "$type_name · $name" : $name];
    }
    // Swedish order (å, ä, ö after z) where the intl extension is there, case-blind byte order where not.
    $collator = class_exists('Collator') ? new Collator('sv_SE') : null;
    $compare = fn (string $a, string $b): int => $collator !== null ? (int) $collator->compare($a, $b) : strcasecmp($a, $b);
    usort($picks, fn (array $a, array $b): int => $compare($a['label'], $b['label']) ?: strcmp($a['id'], $b['id']));
    return core_client_unique_pick_labels($picks);
}

/** The name of a tag type as the first home (by post id) that carries it names it; null when no home does. */
function core_client_tag_type_name(string $type_id): ?string
{
    global $wpdb;
    $post_id = $wpdb->get_var($wpdb->prepare(
        'SELECT post_id FROM ' . core_client_index_table() . " WHERE datatype = 'property' AND tags LIKE %s ORDER BY post_id LIMIT 1",
        '%,' . $wpdb->esc_like($type_id) . ':%',
    ));
    $item = $post_id !== null ? core_client_item((int) $post_id) : null;
    foreach (is_array($item['tags'] ?? null) ? $item['tags'] : [] as $tag) {
        $type = is_array($tag) ? ($tag['type'] ?? null) : null;
        if (is_array($type) && (string) ($type['id'] ?? '') === $type_id) {
            return is_string($type['name'] ?? null) ? $type['name'] : null;
        }
    }
    return null;
}

/**
 * @param array<string, mixed> $item
 * @param array<string, string> $offices office names by id, for an agent's label
 */
function core_client_pick_label(string $entity, array $item, array $offices): string
{
    $name = trim((string) ($item['name'] ?? ''));
    $address = is_array($item['address'] ?? null) ? $item['address'] : [];
    $second = match ($entity) {
        'area' => core_client_municipality_name(is_string($item['county_municipality_code'] ?? null) ? $item['county_municipality_code'] : null),
        'office' => is_string($address['city'] ?? null) ? $address['city'] : null,
        default => $offices[(string) ((is_array($item['office_ids'] ?? null) ? $item['office_ids'] : [])[0] ?? '')] ?? null,
    };
    $label = $name !== '' ? $name : (string) ($item['id'] ?? '');
    return $second !== null && $second !== '' ? "$label · $second" : $label;
}

/**
 * The site's offices' names by id, in one query, for the agents' labels.
 *
 * @return array<string, string>
 */
function core_client_office_names(): array
{
    $names = [];
    foreach (core_client_query(['entity' => 'office', 'per_page' => 5000])['items'] as $row) {
        if (is_string($row['item']['id'] ?? null) && is_string($row['item']['name'] ?? null) && $row['item']['name'] !== '') {
            $names[$row['item']['id']] = $row['item']['name'];
        }
    }
    return $names;
}

/** The pick endpoint: `GET /wp-json/core/v1/picks?entity=agent|office|area|tag`, for a signed-in editor. */
add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/picks', [
        'methods' => 'GET',
        'permission_callback' => fn (): bool => current_user_can('edit_posts'),
        'args' => ['entity' => ['type' => 'string', 'enum' => ['agent', 'office', 'area', 'tag'], 'required' => true]],
        'callback' => fn (WP_REST_Request $request): WP_REST_Response => new WP_REST_Response(core_client_picks((string) $request->get_param('entity'))),
    ]);
});
