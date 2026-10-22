<?php
// A home's agents at the side of its page, a live part (core/list-part.php): the responsible
// agent first and the others under "Kontakta även", where the page's contact buttons land
// (#k-agents). It carries whom the form window names when a form cannot be sent, so the window
// takes the agent as the part shows them now.
//
// In scope: $post_id, $item (the home), $params.

declare(strict_types=1);

$agents = core_client_items('agent', is_array($item['agent_ids'] ?? null) ? $item['agent_ids'] : []);
if ($agents === []) {
    return;
}
?>
<div class="k-property__contact" id="k-agents" data-contact="<?php echo esc_attr((string) wp_json_encode(kowboy_contact($agents[0]['item']))); ?>">
    <?php foreach (['Ansvarig mäklare' => array_slice($agents, 0, 1), 'Kontakta även' => array_slice($agents, 1)] as $agents_title => $agents_group) : ?>
        <?php if ($agents_group !== []) : ?>
            <div class="k-property__agents">
                <h2 class="k-heading"><?php echo esc_html($agents_title); ?></h2>
                <?php foreach ($agents_group as $agent) : ?><?php echo kowboy_part('agent-card', ['item' => $agent['item'], 'post_id' => $agent['post_id']]); ?><?php endforeach; ?>
            </div>
        <?php endif; ?>
    <?php endforeach; ?>
</div>
