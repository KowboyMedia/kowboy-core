<?php
// The fixture set's one view: a card that names itself.

declare(strict_types=1);

echo '<article class="fixture-card">' . esc_html((string) ($item['address']['street'] ?? '')) . '</article>';
