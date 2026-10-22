<?php
// A page: its blocks, between the header and the footer. The design's pages are made of the
// theme's section blocks; a page without them shows its text in the reading column.

declare(strict_types=1);

get_header();
while (have_posts()) {
    the_post();
    if (has_blocks()) {
        the_content();
    } else {
        echo '<article class="k-container k-prose"><h1>' . esc_html(get_the_title()) . '</h1>';
        the_content();
        echo '</article>';
    }
}
get_footer();
