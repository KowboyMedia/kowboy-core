<?php
// The agent list block: the list function with the block's settings, in the set's views.

declare(strict_types=1);

/** @var array<string, mixed> $attributes the block's settings, as WordPress hands them to a render file */
echo '<div ' . get_block_wrapper_attributes(['class' => 'core-list-block']) . '>' . core_client_list_block($attributes, 'agent') . '</div>';
