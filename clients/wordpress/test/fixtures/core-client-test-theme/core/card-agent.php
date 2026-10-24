<?php
// An agent's card: the name, linked to the agent's page.
//
// In scope: $post_id, $item.

declare(strict_types=1);
?>
<article class="t-agent"><a href="<?php echo esc_url((string) get_permalink($post_id)); ?>"><?php echo esc_html((string) ($item['name'] ?? '')); ?></a></article>
