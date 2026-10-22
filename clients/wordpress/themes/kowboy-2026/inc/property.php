<?php
// A home's status label, the same on the list's card and on the home's page (Patric, 2026-10-07):
// the next viewing when one is ahead, else the status as the CRM names it. A sold home keeps its
// status, whatever the viewings say. And the home's street as a title shows it.

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

/**
 * A home's street as a title shows it: no line break right before the street number or anywhere
 * after it, so "Adress 49 f" never breaks (Patric, 2026-10-07). From the word before the first
 * number that follows a word, the spaces are non-breaking; a street without a number is as sent.
 */
function kowboy_street(string $street): string
{
    return preg_replace_callback('/\S+\s+\d.*$/su', fn (array $match): string => preg_replace('/\s+/u', "\u{00A0}", $match[0]) ?? $match[0], $street) ?? $street;
}
