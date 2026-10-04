<?php
// The search box of docs/search.md ("The search box: the combo box with pills"): one function
// draws it for any set, with the places a visitor may choose written into the markup as the
// options of a plain multi-select, so the box is full the moment the page shows and no second
// request is made. It offers only the places that would give a result: the areas, kommuner and
// län with at least one home matching the list's own setting (its statuses and its "show only
// from these"), one group count over the index per group, through the same condition the list
// query uses. The box itself is Tom Select (lib/tom-select, decision of 2026-10-04, question 140 a:
// Patric found our own box immature on his second look): it turns the select into a combo box
// with the chosen places as pills; the plugin's small script (assets/place-search.js) sets it up on
// the page and inside every shadow root, writes the choice to the hidden fields and the address,
// and tells the list on the page to reload its cards.

declare(strict_types=1);

/**
 * The places a list offers: areas (the link table), kommuner and län (the first four and two
 * digits of the homes' codes), each with its label and how many homes it holds, for the list's
 * own setting: the visitor's choices and the paging leave the parameter set first. An area the
 * site has no record of is offered too, named as its homes name it (Patric, 2026-10-04: the
 * staging site's homes name areas that are not in the areas the CRM lists), since the links
 * carry the CRM's assignment whether or not the area's own record arrived.
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
        "SELECT pl.area_id AS id, COALESCE(pa.sort_name, MAX(CASE WHEN i.area_id = pl.area_id THEN i.area_name END)) AS name, COALESCE(pa.county_municipality_code, MAX(CASE WHEN i.area_id = pl.area_id THEN i.county_municipality_code END)) AS code, COUNT(*) AS homes
         FROM $from JOIN $links pl ON pl.post_id = i.post_id LEFT JOIN $index pa ON pa.datatype = 'area' AND pa.remote_id = pl.area_id
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
 * An area's name and kommun code as its own homes carry them (the homes whose CRM area it is,
 * not those its outline holds), by the same rule as the places query, for an area the site
 * has no record of. Both null when no home names it.
 *
 * @return array{name: string|null, code: string|null}
 */
function core_client_area_as_homes_name_it(string $area_id): array
{
    global $wpdb;
    $index = core_client_index_table();
    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT MAX(area_name) AS name, MAX(county_municipality_code) AS code FROM $index WHERE datatype IN ('property', 'project') AND area_id = %s",
        $area_id,
    ));
    return [
        'name' => is_object($row) && is_string($row->name) ? $row->name : null,
        'code' => is_object($row) && is_string($row->code) ? $row->code : null,
    ];
}

/**
 * The places the address names, for the pills the box shows: an area as the box offers it
 * (`$offered`, id to label), so a pill reads the same drawn from the address as chosen from the
 * list; else by its stored record, else as its homes name it. A code by the plugin's tables. A
 * place the site does not know at all reads as its id.
 *
 * @param list<string> $area_ids
 * @param list<string> $codes
 * @param array<string, string> $offered
 * @return list<array{kind: string, id: string, label: string}>
 */
function core_client_place_pills(array $area_ids, array $codes, array $offered = []): array
{
    $pills = [];
    foreach ($area_ids as $area_id) {
        if (isset($offered[$area_id])) {
            $pills[] = ['kind' => 'areas', 'id' => $area_id, 'label' => $offered[$area_id]];
            continue;
        }
        $post_id = core_client_post_id('area', $area_id);
        $area = $post_id === null ? null : core_client_item($post_id);
        if (is_array($area)) {
            $name = is_string($area['name'] ?? null) ? $area['name'] : '';
            $code = is_string($area['county_municipality_code'] ?? null) ? $area['county_municipality_code'] : null;
        } else {
            ['name' => $named, 'code' => $code] = core_client_area_as_homes_name_it($area_id);
            $name = $named ?? '';
        }
        $pills[] = ['kind' => 'areas', 'id' => $area_id, 'label' => core_client_area_label($name, $code, $area_id)];
    }
    foreach ($codes as $code) {
        $label = strlen($code) === 2 ? (CORE_CLIENT_COUNTIES[$code] ?? null) : core_client_municipality_name($code);
        if ($label !== null && strlen($code) === 6) {
            $label .= " ($code)"; // a whole code: the kommun's name and the code, apart from the kommun itself
        }
        $pills[] = ['kind' => 'lkf', 'id' => $code, 'label' => $label ?? $code];
    }
    return $pills;
}

/**
 * The box: a multi-select of the places in three groups, the chosen ones selected (a chosen
 * place the list does not offer, its homes all sold here, is added to its group so its pill
 * shows and can be taken away), and the three hidden fields that carry the search (`q`, the
 * free text; `areas` and `lkf`, the chosen places), so a plain form submit and the script's
 * reload send the same parameters. An option's value is its kind and id, `areas:D-2` or
 * `lkf:0180`, which the script splits into the two fields. The select carries no name: the
 * script writes the fields, and the stylesheet keeps the select unseen until the script takes
 * it, so without the script there is no box. Empty when the list has no place search.
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
    $groups = core_client_places($params);
    $offered = [];
    foreach ($groups['areas'] as $place) {
        $offered[$place['id']] = $place['label'];
    }
    $area_ids = core_client_query_list($params['areas'] ?? null);
    $codes = array_values(array_filter(core_client_query_list($params['lkf'] ?? null), fn (string $code): bool => preg_match('/^(\d{2}|\d{4}|\d{6})$/', $code) === 1));
    $chosen = [];
    foreach (core_client_place_pills($area_ids, $codes, $offered) as $pill) {
        $group = $pill['kind'] === 'areas' ? 'areas' : (strlen($pill['id']) === 2 ? 'counties' : 'municipalities');
        $chosen[$group][$pill['id']] = true;
        $ids = array_column($groups[$group], 'id');
        if (!in_array($pill['id'], $ids, true)) {
            $groups[$group][] = ['id' => $pill['id'], 'label' => $pill['label'], 'homes' => 0]; // marked in the markup; the script drops it with its pill
        }
    }
    $words = ($params['q'] ?? '') !== '' ? $params['q'] : ($params['area'] ?? '');
    $q = is_scalar($words) ? trim((string) $words) : '';
    // One id per box drawn in the request, so two boxes on one page keep their own label and list.
    static $drawn = 0;
    $id = 'core-place-' . ++$drawn;
    $placeholder = $level === 'areas' ? 'Område' : 'Område, kommun eller län';

    $html = '<div class="core-place-search" data-place-search>';
    $html .= '<label class="core-place-search__label" for="' . esc_attr($id) . '">Plats</label>';
    $html .= '<select class="core-place-search__select" id="' . esc_attr($id) . '" multiple autocomplete="off" data-placeholder="' . esc_attr($placeholder) . '" data-no-match="' . esc_attr('Ingen plats matchar. Enter söker orden som text.') . '">';
    foreach (['areas' => 'Områden', 'municipalities' => 'Kommuner', 'counties' => 'Län'] as $group => $heading) {
        if ($groups[$group] === []) {
            continue;
        }
        $kind = $group === 'areas' ? 'areas' : 'lkf';
        $html .= '<optgroup label="' . esc_attr($heading) . '">';
        foreach ($groups[$group] as $place) {
            $selected = isset($chosen[$group][$place['id']]) ? ' selected' : '';
            $unoffered = $place['homes'] === 0 ? ' data-homes="0"' : '';
            $html .= '<option value="' . esc_attr($kind . ':' . $place['id']) . '"' . $selected . $unoffered . '>' . esc_html($place['label']) . '</option>';
        }
        $html .= '</optgroup>';
    }
    $html .= '</select>';
    $html .= '<input type="hidden" name="q" value="' . esc_attr($q) . '">';
    $html .= '<input type="hidden" name="areas" value="' . esc_attr(implode(',', $area_ids)) . '">';
    $html .= '<input type="hidden" name="lkf" value="' . esc_attr(implode(',', $codes)) . '">';
    return $html . '</div>';
}

/**
 * The addresses of the box's stylesheets, the library's first so the plugin's rules win over it,
 * for the page and for the shadow roots the plugin opens.
 *
 * @return list<string>
 */
function core_client_place_search_css(): array
{
    return [
        add_query_arg('ver', CORE_CLIENT_VERSION, plugins_url('lib/tom-select/tom-select.min.css', CORE_CLIENT_FILE)),
        add_query_arg('ver', CORE_CLIENT_VERSION, plugins_url('assets/place-search.css', CORE_CLIENT_FILE)),
    ];
}

/** Whether a box was drawn in this request, so `core_client_wrap` links the stylesheets inside the root too. */
function core_client_place_search_used(?bool $used = null): bool
{
    static $drawn = false;
    if ($used !== null) {
        $drawn = $used;
    }
    return $drawn;
}

/** The library, the box's script and the two stylesheets, loaded only on a page that draws a box. */
function core_client_place_search_assets(): void
{
    core_client_place_search_used(true);
    foreach (core_client_place_search_css() as $index => $css) {
        wp_enqueue_style($index === 0 ? 'core-client-tom-select' : 'core-client-place-search', $css, [], null);
    }
    wp_enqueue_script('core-client-tom-select', plugins_url('lib/tom-select/tom-select.complete.min.js', CORE_CLIENT_FILE), [], CORE_CLIENT_VERSION, ['in_footer' => true]);
    wp_enqueue_script('core-client-place-search', plugins_url('assets/place-search.js', CORE_CLIENT_FILE), ['core-client-tom-select'], CORE_CLIENT_VERSION, ['in_footer' => true]);
}
