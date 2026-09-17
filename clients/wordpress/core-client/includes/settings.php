<?php
// The three settings (SRS Appendix A): Core URL, tenant token, bell secret. Nothing else. The
// settings page also shows the last successful sync, which an operator must be able to see (SRS §8).

declare(strict_types=1);

/** @return array{url: string, token: string, bell_secret: string} */
function core_client_settings(): array
{
    return [
        'url' => rtrim((string) get_option('core_client_url', ''), '/'),
        'token' => (string) get_option('core_client_token', ''),
        'bell_secret' => (string) get_option('core_client_bell_secret', ''),
    ];
}

add_action('admin_init', function (): void {
    register_setting('core_client', 'core_client_url', ['type' => 'string', 'sanitize_callback' => 'esc_url_raw']);
    register_setting('core_client', 'core_client_token', ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field']);
    register_setting('core_client', 'core_client_bell_secret', ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field']);
});

add_action('admin_menu', function (): void {
    add_options_page('Kowboy Core', 'Kowboy Core', 'manage_options', 'core-client', 'core_client_settings_page');
});

function core_client_settings_page(): void
{
    $status = core_client_status();
    ?>
    <div class="wrap">
        <h1>Kowboy Core</h1>
        <form method="post" action="options.php">
            <?php settings_fields('core_client'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="core_client_url">Core URL</label></th>
                    <td><input type="url" id="core_client_url" name="core_client_url" class="regular-text"
                               value="<?php echo esc_attr((string) get_option('core_client_url', '')); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="core_client_token">Tenant token</label></th>
                    <td><input type="password" id="core_client_token" name="core_client_token" class="regular-text" autocomplete="off"
                               value="<?php echo esc_attr((string) get_option('core_client_token', '')); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="core_client_bell_secret">Bell secret</label></th>
                    <td><input type="password" id="core_client_bell_secret" name="core_client_bell_secret" class="regular-text" autocomplete="off"
                               value="<?php echo esc_attr((string) get_option('core_client_bell_secret', '')); ?>"></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <h2>Sync</h2>
        <p>Bell URL for Kowboy: <code><?php echo esc_html(rest_url('core/v1/bell')); ?></code></p>
        <table class="widefat striped" style="max-width: 40em">
            <tr><th>Last successful sync</th><td><?php echo esc_html($status['last_success_at'] ?? 'never'); ?></td></tr>
            <tr><th>Last error</th><td><?php echo esc_html($status['last_error'] ?? 'none'); ?></td></tr>
            <tr><th>Running since</th><td><?php echo esc_html($status['running_since'] ?? 'not running'); ?></td></tr>
            <?php foreach (core_client_datatypes() as $datatype) : ?>
                <tr>
                    <th><?php echo esc_html($datatype); ?></th>
                    <td><?php echo (int) $status['items'][$datatype]; ?> items, cursor <?php echo (int) $status['after'][$datatype]; ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </div>
    <?php
}
