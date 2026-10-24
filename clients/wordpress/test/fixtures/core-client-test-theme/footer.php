<?php
// The page's foot: a form window while the site's forms are on, pointed at the site's own
// receivers with the bot check's public key, as a theme's window takes them from the plugin.

declare(strict_types=1);

$human = core_client_forms_on() ? core_client_human_check() : null;
?>
<?php if (core_client_forms_on()) : ?>
<dialog class="t-form" data-endpoint="<?php echo esc_attr(rest_url('core/v1/forms')); ?>" data-slots="<?php echo esc_attr(rest_url('core/v1/forms/slots')); ?>"<?php if (is_array($human)) : ?> data-human-key="<?php echo esc_attr((string) ($human['site_key'] ?? '')); ?>"<?php endif; ?>></dialog>
<?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
