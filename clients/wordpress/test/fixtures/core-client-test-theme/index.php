<?php
// Any other page: its title and content, so a page of shortcodes or blocks renders its lists.

declare(strict_types=1);

get_header();
while (have_posts()) {
    the_post();
    echo '<article class="t-post"><h1>' . esc_html(get_the_title()) . '</h1>';
    the_content();
    echo '</article>';
}
get_footer();
