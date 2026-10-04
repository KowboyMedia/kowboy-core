<?php
// The agents block: the agents as the theme's agent cards (core/card-agent.php), every one or
// the chosen offices' (the plugin's list settings, includes/blocks.php there), in the order Core
// delivers them; the home page lists them all (Patric, 2026-10-03), so no count is asked. The
// theme lays the cards out itself, with its text card and button beside them.

declare(strict_types=1);

if (!function_exists('core_client_list_block')) {
    return;
}
$cards = core_client_list_block($attributes, 'agent', ['part' => 'cards', 'shadow' => false]);
$has_card = ($attributes['cardTitle'] ?? '') !== '';
echo kowboy_section_open('k-agents');
echo '<div class="k-container">';
if (($attributes['title'] ?? '') !== '') {
    echo '<h2 class="k-section__title">' . esc_html((string) $attributes['title']) . '</h2>';
}
if (($attributes['lead'] ?? '') !== '') {
    echo '<p class="k-section__lead">' . esc_html((string) $attributes['lead']) . '</p>';
}
echo '<div class="k-agents__grid' . ($has_card ? ' k-agents__grid--with-card' : '') . '">' . $cards;
if ($has_card) {
    echo '<div class="k-info-card">';
    if (($attributes['cardLabel'] ?? '') !== '') {
        echo '<p class="k-label">' . esc_html((string) $attributes['cardLabel']) . '</p>';
    }
    echo '<h3 class="k-info-card__title">' . esc_html((string) $attributes['cardTitle']) . '</h3>';
    if (($attributes['cardText'] ?? '') !== '') {
        echo '<p class="k-info-card__text">' . esc_html((string) $attributes['cardText']) . '</p>';
    }
    if (($attributes['cardButtonLabel'] ?? '') !== '') {
        echo '<a class="k-button" href="' . esc_url((string) ($attributes['cardButtonUrl'] ?? '#')) . '">' . esc_html((string) $attributes['cardButtonLabel']) . '</a>';
    }
    echo '</div>';
}
echo '</div></div></section>';
