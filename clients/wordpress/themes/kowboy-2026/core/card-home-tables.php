<?php
// A home's fact tables, a live part of its page (core/list-part.php): every table of
// `display.sections` as one accordion item, closed at first (Patric, 2026-10-03), the
// association's rows added as "Föreningen", and the documents and links of the home and its
// association as one list. A live part, since the association is another record.
//
// In scope: $post_id, $item (the home), $params.

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
// This site's rule, as the design shows it: a sold home keeps its text, chips, plan and photos, and shows no fact tables.
if (isset($display['final_price'])) {
    return;
}
$sections = is_array($display['sections'] ?? null) ? $display['sections'] : [];
$association = core_client_items('association', [$item['association_id'] ?? null])[0]['item'] ?? null;
if ($association !== null) {
    $rows = kowboy_association_rows($association);
    if ($rows !== []) {
        $sections[] = ['header' => 'Föreningen', 'items' => array_map(fn ($label, $value) => ['label' => (string) $label, 'value' => (string) $value], array_keys($rows), $rows)];
    }
}
// The documents and the links the CRM lists on the home and on its association, read from both
// and deduplicated by address, then by name (question 94, Patric 2026-10-03), each opened from the
// address Core carries, as one list with an icon per kind (Patric, 2026-10-03: "Dokument och länkar").
$resources = [];
$seen = [];
foreach ([
    ['document', is_array($item['documents'] ?? null) ? $item['documents'] : []],
    ['document', is_array($association['documents'] ?? null) ? $association['documents'] : []],
    ['link', is_array($item['links'] ?? null) ? $item['links'] : []],
    ['link', is_array($association['links'] ?? null) ? $association['links'] : []],
] as [$kind, $entries]) {
    foreach ($entries as $entry) {
        $name = is_string($entry['name'] ?? null) ? trim($entry['name']) : '';
        $url = is_string($entry['url'] ?? null) ? trim($entry['url']) : '';
        $key = $url !== '' ? 'url:' . mb_strtolower($url) : 'name:' . $kind . ':' . mb_strtolower($name);
        if ($url === '' || isset($seen[$key]) || isset($seen['name:' . $kind . ':' . mb_strtolower($name)])) {
            continue;
        }
        $seen[$key] = true;
        $seen['name:' . $kind . ':' . mb_strtolower($name)] = true;
        $resources[] = ['kind' => $kind, 'name' => $name !== '' ? $name : $url, 'url' => $url];
    }
}

// Every fact table as one accordion item: a definition list of its rows.
$tables = [];
foreach ($sections as $section) {
    $items = is_array($section['items'] ?? null) ? $section['items'] : [];
    if ($items === []) {
        continue;
    }
    $rows = '';
    foreach ($items as $row) {
        $rows .= '<div class="k-kv__row"><dt>' . esc_html((string) ($row['label'] ?? '')) . '</dt><dd>' . (!empty($row['html']) ? wp_kses_post((string) $row['value']) : esc_html((string) ($row['value'] ?? ''))) . '</dd></div>';
    }
    $tables[] = ['label' => (string) ($section['header'] ?? ''), 'html' => '<dl class="k-kv">' . $rows . '</dl>'];
}
if ($resources !== []) {
    $icons = [
        'document' => '<svg class="k-docs__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
        'link' => '<svg class="k-docs__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
    ];
    $resources_html = '';
    foreach ($resources as $resource) {
        $resources_html .= '<li class="k-docs__item"><a class="k-docs__link" href="' . esc_url($resource['url']) . '" target="_blank" rel="noopener">' . $icons[$resource['kind']] . '<span class="k-docs__name">' . esc_html($resource['name']) . '</span></a></li>';
    }
    $tables[] = ['label' => 'Dokument och länkar', 'html' => '<ul class="k-docs">' . $resources_html . '</ul>'];
}
if ($tables === []) {
    return;
}
?>
<div class="k-container k-property__tables"><?php echo kowboy_part('accordion', ['items' => $tables]); ?></div>
