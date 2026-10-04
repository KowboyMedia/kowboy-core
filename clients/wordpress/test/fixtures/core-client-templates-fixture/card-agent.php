<?php
// The fixture set's agent card: one that names itself.

declare(strict_types=1);

echo '<article class="fixture-agent">' . esc_html((string) ($item['name'] ?? '')) . '</article>';
