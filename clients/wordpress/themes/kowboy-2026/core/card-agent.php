<?php
// One agent card: the theme's part, so the agents block, the agent list and a property page share it.

declare(strict_types=1);

echo kowboy_part('agent-card', ['item' => $item, 'post_id' => $post_id]);
