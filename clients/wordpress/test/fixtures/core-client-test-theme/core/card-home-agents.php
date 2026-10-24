<?php
// A home's agents, in the home's order, each linked to their page.
//
// In scope: $item (the home).

declare(strict_types=1);

foreach (core_client_items('agent', is_array($item['agent_ids'] ?? null) ? $item['agent_ids'] : []) as $agent) {
    echo '<p class="t-home-agent"><a href="' . esc_url((string) get_permalink($agent['post_id'])) . '">' . esc_html((string) ($agent['item']['name'] ?? '')) . '</a></p>';
}
