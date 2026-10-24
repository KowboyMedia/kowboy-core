<?php
// A home's page: its street, its agents as a live part, and a button that opens the form window
// on this home, named by its connection and its id.
//
// In scope: $post_id, $item.

declare(strict_types=1);

$id = (string) ($item['id'] ?? '');
$record = 'property:' . (string) core_client_connection_of($post_id) . ':' . $id;
?>
<article class="t-home">
<h1><?php echo esc_html((string) ($item['address']['street'] ?? '')); ?></h1>
<?php echo core_client_list(['entity' => 'property', 'ids' => $id, 'per_page' => 1, 'card' => 'home-agents', 'wrapper' => 'part', 'page' => 1, 'styleisolation' => false])['html']; ?>
<?php if (core_client_forms_on()) : ?><a class="t-button" href="#" data-form="interest" data-record="<?php echo esc_attr($record); ?>">Anmäl intresse</a><?php endif; ?>
</article>
