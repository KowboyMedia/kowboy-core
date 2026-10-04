<?php
// The search box of docs/search.md ("The search box: the combo box with pills"): one function
// draws it for any set, with the places a visitor may choose written into the markup as data,
// so the box is full the moment the page shows and no second request is made. It offers only the
// places that would give a result: the areas, kommuner and län with at least one home matching
// the list's own setting (its statuses and its "show only from these"), one group count over the
// index per group, through the same condition the list query uses. The chosen places stand as
// pills; the plugin's small script (assets/place-search.js) narrows the suggestions as the
// visitor types, keeps the pills, writes the choice to the address and tells the list on the page
// to reload its cards. Not a library (decision of 2026-10-04): the box must work inside the
// shadow root and on the open page alike, over a few hundred entries, in the set's look.

declare(strict_types=1);

/**
 * The places a list offers: areas (the link table), kommuner and län (the first four and two
 * digits of the homes' codes), each with its label and how many homes it holds, for the list's
 * own setting: the visitor's choices and the paging leave the parameter set first.
 *
 * @param array<string, mixed> $params the list's parameter set, with `place_search` = `areas` or `places`
 * @return array{areas: list<array{id: string, label: string, homes: int}>, municipalities: list<array{id: string, label: string, homes: int}>, counties: list<array{id: string, label: string, homes: int}>}
 */
function core_client_places(array $params): array
{
    global $wpdb;
    $places = ['areas' => [], 'municipalities' => [], 'counties' => []];
    $level = (string) ($params['place_search'] ?? 'none');
    if ($level !== 'areas' && $level !== 'places') {
        return $places;
    }
    $own = array_diff_key($params, array_flip(['q', 'area', 'areas', 'lkf', 'max_price', 'min_price', 'min_living_space', 'max_living_space', 'min_rooms', 'page', 'per_page', 'part', 'title', 'lead', 'shadow']));
    [$condition, $args] = core_client_query_condition($own);
    $index = core_client_index_table();
    $from = "$index i JOIN {$wpdb->posts} p ON p.ID = i.post_id";
    $links = core_client_links_table();
    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT pl.area_id AS id, pa.sort_name AS name, pa.county_municipality_code AS code, COUNT(*) AS homes
         FROM $from JOIN $links pl ON pl.post_id = i.post_id JOIN $index pa ON pa.datatype = 'area' AND pa.remote_id = pl.area_id
         WHERE $condition GROUP BY pl.area_id, pa.sort_name, pa.county_municipality_code",
        ...$args,
    ));
    foreach ($rows ?: [] as $row) {
        $places['areas'][] = ['id' => (string) $row->id, 'label' => core_client_area_label((string) ($row->name ?? ''), is_string($row->code) ? $row->code : null, (string) $row->id), 'homes' => (int) $row->homes];
    }
    if ($level === 'places') {
        foreach (['municipalities' => [4, CORE_CLIENT_MUNICIPALITIES], 'counties' => [2, CORE_CLIENT_COUNTIES]] as $group => [$length, $table]) {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT SUBSTRING(i.county_municipality_code, 1, %d) AS code, COUNT(*) AS homes FROM $from WHERE $condition AND i.county_municipality_code IS NOT NULL GROUP BY code",
                ...[$length, ...$args],
            ));
            foreach ($rows ?: [] as $row) {
                $name = $table[(string) $row->code] ?? null;
                if ($name !== null) {
                    $places[$group][] = ['id' => (string) $row->code, 'label' => $name, 'homes' => (int) $row->homes];
                }
            }
        }
    }
    foreach ($places as &$group) {
        usort($group, fn (array $a, array $b): int => strcoll($a['label'], $b['label']));
    }
    unset($group);
    return $places;
}

/** An area's label: its name with its kommun after it, as the design reads it ("Dalhem · Helsingborg"); the id when it has no name. */
function core_client_area_label(string $name, ?string $code, string $id): string
{
    $municipality = core_client_municipality_name($code);
    $label = $name !== '' ? $name : $id;
    return $municipality === null ? $label : "$label · $municipality";
}

/**
 * The labels of the places the address names, for the pills the page renders: an area by its
 * stored record, a code by the plugin's tables; a place the site no longer knows reads as its id.
 *
 * @param list<string> $area_ids
 * @param list<string> $codes
 * @return list<array{kind: string, id: string, label: string}>
 */
function core_client_place_pills(array $area_ids, array $codes): array
{
    $pills = [];
    foreach ($area_ids as $area_id) {
        $post_id = core_client_post_id('area', $area_id);
        $area = $post_id === null ? null : core_client_item($post_id);
        $code = is_string($area['county_municipality_code'] ?? null) ? $area['county_municipality_code'] : null;
        $pills[] = ['kind' => 'areas', 'id' => $area_id, 'label' => core_client_area_label(is_string($area['name'] ?? null) ? $area['name'] : '', $code, $area_id)];
    }
    foreach ($codes as $code) {
        $label = strlen($code) === 2 ? (CORE_CLIENT_COUNTIES[$code] ?? null) : core_client_municipality_name($code);
        $pills[] = ['kind' => 'lkf', 'id' => $code, 'label' => $label ?? $code];
    }
    return $pills;
}

/**
 * The box: the field (`q`, the free text), the suggestions as data, the pills of the chosen
 * places and the two hidden fields that carry them (`areas`, `lkf`), so a plain form submit and
 * the script's reload send the same parameters. Empty when the list has no place search.
 *
 * @param array<string, mixed> $params the list's parameter set
 */
function core_client_place_search(array $params): string
{
    $level = (string) ($params['place_search'] ?? 'none');
    if ($level !== 'areas' && $level !== 'places') {
        return '';
    }
    core_client_place_search_assets();
    $data = [];
    foreach (core_client_places($params) as $group => $places) {
        foreach ($places as $place) {
            $data[] = ['group' => $group, 'id' => $place['id'], 'label' => $place['label']];
        }
    }
    $area_ids = core_client_query_list($params['areas'] ?? null);
    $codes = array_values(array_filter(core_client_query_list($params['lkf'] ?? null), fn (string $code): bool => preg_match('/^(\d{2}|\d{4}|\d{6})$/', $code) === 1));
    $pills = core_client_place_pills($area_ids, $codes);
    $q = trim((string) (($params['q'] ?? '') !== '' ? $params['q'] : ($params['area'] ?? '')));
    $id = 'core-place-' . substr(md5((string) wp_json_encode([$params, $data])), 0, 8);
    $placeholder = $level === 'areas' ? 'Område' : 'Område, kommun eller län';

    $html = '<div class="core-place-search" data-place-search data-places="' . esc_attr((string) wp_json_encode($data, JSON_UNESCAPED_UNICODE)) . '">';
    $html .= '<label class="core-place-search__label" for="' . esc_attr($id) . '">Plats</label>';
    $html .= '<input class="core-place-search__input" id="' . esc_attr($id) . '" type="search" name="q" value="' . esc_attr($q) . '" placeholder="' . esc_attr($placeholder) . '" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="' . esc_attr($id) . '-list">';
    $html .= '<ul class="core-place-search__list" id="' . esc_attr($id) . '-list" role="listbox" aria-label="Platser" hidden></ul>';
    $html .= '<div class="core-place-search__pills" data-pills>';
    foreach ($pills as $pill) {
        $html .= '<button type="button" class="core-place-search__pill" data-pill-kind="' . esc_attr($pill['kind']) . '" data-pill-id="' . esc_attr($pill['id']) . '" aria-label="' . esc_attr('Ta bort ' . $pill['label']) . '">' . esc_html($pill['label']) . '<span aria-hidden="true"> ×</span></button>';
    }
    $html .= '</div>';
    $html .= '<input type="hidden" name="areas" value="' . esc_attr(implode(',', $area_ids)) . '">';
    $html .= '<input type="hidden" name="lkf" value="' . esc_attr(implode(',', $codes)) . '">';
    return $html . '</div>';
}

/** The address of the box's stylesheet, for the page and for the shadow roots the plugin opens. */
function core_client_place_search_css(): string
{
    return add_query_arg('ver', CORE_CLIENT_VERSION, plugins_url('assets/place-search.css', CORE_CLIENT_FILE));
}

/** Whether a box was drawn in this request, so `core_client_wrap` links the stylesheet inside the root too. */
function core_client_place_search_used(?bool $used = null): bool
{
    static $drawn = false;
    if ($used !== null) {
        $drawn = $used;
    }
    return $drawn;
}

/** The box's script and stylesheet, loaded only on a page that draws a box. */
function core_client_place_search_assets(): void
{
    core_client_place_search_used(true);
    wp_enqueue_style('core-client-place-search', core_client_place_search_css(), [], null);
    wp_enqueue_script('core-client-place-search', plugins_url('assets/place-search.js', CORE_CLIENT_FILE), [], CORE_CLIENT_VERSION, ['in_footer' => true]);
}
