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
    return kowboy_property_label_steps($item)[0][1];
}

/**
 * The label's words over time: each viewing ahead with its start (a Unix time), soonest first,
 * then the status with none. A kept page (the page cache) outlives a viewing, so the label carries
 * them all and the browser shows the first whose viewing has not begun (assets/kowboy-2026.js).
 *
 * @param array<string, mixed> $item the record as Core delivered it
 * @return non-empty-list<array{0: int|null, 1: string}>
 */
function kowboy_property_label_steps(array $item): array
{
    $label = (string) ($item['status']['name'] ?? '');
    if (isset($item['display']['final_price'])) {
        return [[null, $label]];
    }
    $starts = [];
    foreach (is_array($item['viewings'] ?? null) ? $item['viewings'] : [] as $viewing) {
        $start = is_string($viewing['starts_at'] ?? null) ? strtotime($viewing['starts_at']) : false;
        if ($start !== false && $start >= time()) {
            $starts[$start] = true;
        }
    }
    ksort($starts);
    $steps = [];
    foreach (array_keys($starts) as $start) {
        $steps[] = [$start, 'Visning ' . wp_date('D j M H:i', $start)];
    }
    $steps[] = [null, $label];
    return $steps;
}

/**
 * The label's steps as an attribute for the browser, or nothing when no viewing is ahead.
 *
 * @param array<string, mixed> $item the record as Core delivered it
 */
function kowboy_property_label_attribute(array $item): string
{
    $steps = kowboy_property_label_steps($item);
    return count($steps) < 2 ? '' : ' data-label-steps="' . esc_attr((string) wp_json_encode($steps)) . '"';
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
