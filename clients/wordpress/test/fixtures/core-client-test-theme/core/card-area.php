<?php
// An area's card: the name, linked to the area's page.
//
// In scope: $post_id, $item.

declare(strict_types=1);
?>
<article class="t-area"><a href="<?php echo esc_url((string) get_permalink($post_id)); ?>"><?php echo esc_html((string) ($item['name'] ?? '')); ?></a></article>
