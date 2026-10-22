<?php
// The fallback for whatever has no template of its own: the posts as a plain list.

declare(strict_types=1);

get_header();
echo '<div class="k-container k-prose">';
while (have_posts()) {
    the_post();
    echo '<article><h2><a href="' . esc_url((string) get_permalink()) . '">' . esc_html(get_the_title()) . '</a></h2>';
    the_excerpt();
    echo '</article>';
}
echo '</div>';
get_footer();
