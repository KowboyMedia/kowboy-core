<?php
// The agent archive: every listed agent.

declare(strict_types=1);

echo '<h1>Mäklare</h1>' . core_client_list(['entity' => 'agent', 'per_page' => 100, 'styleisolation' => false])['html'];
