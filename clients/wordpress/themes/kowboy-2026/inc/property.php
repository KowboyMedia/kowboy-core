<?php
// A home's status label, the same on the list's card and on the home's page (Patric, 2026-10-07):
// the next viewing when one is ahead, else the status as the CRM names it. A sold home keeps its
// status, whatever the viewings say.

declare(strict_types=1);

/**
 * @param array<string, mixed> $item the record as Core delivered it
 */
function kowboy_property_label(array $item): string
{
    $label = (string) ($item['status']['name'] ?? '');
    if (isset($item['display']['final_price'])) {
        return $label;
    }
    $next_viewing = null;
    foreach (is_array($item['viewings'] ?? null) ? $item['viewings'] : [] as $viewing) {
        $starts = is_string($viewing['starts_at'] ?? null) ? strtotime($viewing['starts_at']) : false;
        if ($starts !== false && $starts >= time() && ($next_viewing === null || $starts < $next_viewing)) {
            $next_viewing = $starts;
        }
    }
    return $next_viewing === null ? $label : 'Visning ' . wp_date('D j M H:i', $next_viewing);
}
