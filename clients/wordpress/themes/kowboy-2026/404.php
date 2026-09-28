<?php
// Nothing at this address.

declare(strict_types=1);

get_header();
echo '<div class="k-container k-prose k-404"><h1>Sidan finns inte</h1><p><a class="k-button" href="' . esc_url(home_url('/')) . '">Till startsidan</a></p></div>';
get_footer();
