<?php
declare(strict_types=1);

echo kowboy_section_open('k-lead-section');
echo '<div class="k-container">' . kowboy_part('lead-form', ['title' => (string) ($attributes['title'] ?? ''), 'text' => (string) ($attributes['text'] ?? ''), 'subject' => '']) . '</div>';
echo '</section>';
