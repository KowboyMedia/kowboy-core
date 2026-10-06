<?php
// The footer: the form card ("Ska du sälja din bostad?", its words from the theme options, its
// button opening the form window) on every page (Patric, 2026-10-03 and 2026-10-04), then the dark
// logotype, the footer menu (with the areas archive, Patric, 2026-10-03), the office's contact
// details and the copyright line.

declare(strict_types=1);

$kowboy_address = (string) kowboy_option('kowboy_address');
$kowboy_phone = (string) kowboy_option('kowboy_phone');
$kowboy_email = (string) kowboy_option('kowboy_email');
?>
</main>
<footer class="k-footer">
    <?php // The seller's lead ("free valuation"): a button that opens the form window; without it, the office's details below. ?>
    <div class="k-container k-footer__lead"><?php echo kowboy_part('form-card', ['title' => (string) kowboy_option('kowboy_form_title'), 'text' => (string) kowboy_option('kowboy_form_text'), 'label' => 'Boka fri värdering', 'form' => 'lead', 'record' => '', 'href' => '#k-contact']); ?></div>
    <div class="k-container k-footer__row">
        <div class="k-footer__logo"><?php echo kowboy_logo(false); ?></div>
        <nav class="k-footer__nav" aria-label="Sidfotsmeny">
            <?php wp_nav_menu(['theme_location' => 'footer', 'container' => false, 'menu_class' => 'k-menu k-menu--footer', 'fallback_cb' => 'kowboy_menu_fallback', 'depth' => 1]); ?>
        </nav>
        <address class="k-footer__contact" id="k-contact">
            <?php if ($kowboy_address !== '') : ?><span><?php echo esc_html($kowboy_address); ?></span><?php endif; ?>
            <?php if ($kowboy_phone !== '') : ?><a href="tel:<?php echo esc_attr(preg_replace('/[^+\d]/', '', $kowboy_phone) ?? ''); ?>"><?php echo esc_html($kowboy_phone); ?></a><?php endif; ?>
            <?php if ($kowboy_email !== '') : ?><a href="mailto:<?php echo esc_attr($kowboy_email); ?>"><?php echo esc_html($kowboy_email); ?></a><?php endif; ?>
        </address>
    </div>
    <p class="k-footer__copyright">© <?php echo esc_html(wp_date('Y') . ' ' . (string) kowboy_option('kowboy_copyright')); ?></p>
</footer>
<?php // The window every form button opens (parts/form-window.php); it talks to the plugin's receivers on this site. ?>
<?php if (function_exists('core_client_human_check')) : ?><?php echo kowboy_part('form-window', ['endpoint' => rest_url('core/v1/forms'), 'slots' => rest_url('core/v1/forms/slots'), 'policy' => (string) get_privacy_policy_url(), 'human' => core_client_human_check()]); ?><?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
