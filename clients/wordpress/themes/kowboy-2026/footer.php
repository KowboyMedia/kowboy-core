<?php
// The footer: the lead form ("Ska du sälja din bostad?", its words from the theme options) on
// every page (Patric, 2026-10-03), then the dark logotype, the footer menu, the office's contact
// details and the copyright line.

declare(strict_types=1);

$kowboy_address = (string) kowboy_option('kowboy_address');
$kowboy_phone = (string) kowboy_option('kowboy_phone');
$kowboy_email = (string) kowboy_option('kowboy_email');
?>
</main>
<footer class="k-footer">
    <div class="k-container k-footer__lead"><?php echo kowboy_part('lead-form', ['title' => (string) kowboy_option('kowboy_form_title'), 'text' => (string) kowboy_option('kowboy_form_text'), 'subject' => '']); ?></div>
    <div class="k-container k-footer__row">
        <div class="k-footer__logo"><?php echo kowboy_logo(false); ?></div>
        <nav class="k-footer__nav" aria-label="Sidfotsmeny">
            <?php wp_nav_menu(['theme_location' => 'footer', 'container' => false, 'menu_class' => 'k-menu k-menu--footer', 'fallback_cb' => 'kowboy_menu_fallback', 'depth' => 1]); ?>
        </nav>
        <address class="k-footer__contact">
            <?php if ($kowboy_address !== '') : ?><span><?php echo esc_html($kowboy_address); ?></span><?php endif; ?>
            <?php if ($kowboy_phone !== '') : ?><a href="tel:<?php echo esc_attr(preg_replace('/[^+\d]/', '', $kowboy_phone) ?? ''); ?>"><?php echo esc_html($kowboy_phone); ?></a><?php endif; ?>
            <?php if ($kowboy_email !== '') : ?><a href="mailto:<?php echo esc_attr($kowboy_email); ?>"><?php echo esc_html($kowboy_email); ?></a><?php endif; ?>
        </address>
    </div>
    <p class="k-footer__copyright">© <?php echo esc_html(wp_date('Y') . ' ' . (string) kowboy_option('kowboy_copyright')); ?></p>
</footer>
<?php wp_footer(); ?>
</body>
</html>
