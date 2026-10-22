<?php
// An association's rows, in the master's order (norbanmakleri.se, question 92), for the fact
// table on a property's page and the association's own page; the three coded values carry the
// CRM's names (question 93).

declare(strict_types=1);

/**
 * @param array<string, mixed> $association
 * @return array<string, string> label => value, the empty ones left out
 */
function kowboy_association_rows(array $association): array
{
    $economy = is_array($association['economy'] ?? null) ? $association['economy'] : [];
    $descriptions = is_array($association['descriptions'] ?? null) ? $association['descriptions'] : [];
    $rows = array_filter([
        'Namn' => $association['name'] ?? null,
        'Allmänt om föreningen' => $descriptions['general_about_association'] ?? null,
        'Renoveringar - utförda och planerade' => $descriptions['renovations'] ?? null,
        'Parkering' => $descriptions['parking'] ?? null,
        'Tv och bredband' => $descriptions['tv_and_broadband'] ?? null,
        'Gårdsplats/innergård' => $descriptions['courtyard'] ?? null,
        'Gemensamma utrymmen' => $descriptions['shared_spaces'] ?? null,
        'Övrigt' => $descriptions['other'] ?? null,
        'Antal lägenheter' => $association['number_of_apartments'] ?? null,
        'Föreningens ekonomi och planerade förändringar' => $economy['finances'] ?? null,
        'Överlåtelseavgift' => $association['display']['transfer_fee'] ?? null,
        'Pantsättningsavgift' => $association['display']['pledge_fee'] ?? null,
        'Organisationsnummer' => $association['corporate_number'] ?? null,
        'Överlåtelseavgift betalas av' => $economy['transfer_fee_paid_by']['name'] ?? null,
        'Äkta/Oäkta förening' => $association['genuine_association']['name'] ?? null,
        'Tillåter föreningen juridisk person som köpare' => $economy['allow_legal_person_as_buyer']['name'] ?? null,
        'Tillåter föreningen delat ägande' => $economy['allows_shared_ownership_info'] ?? null,
        'Äger föreningen marken' => $economy['the_association_own_the_ground'] ?? null,
    ], fn (mixed $value): bool => $value !== null && $value !== '');
    return array_map(fn (mixed $value): string => (string) $value, $rows);
}
