<?php
// The settings (SRS Appendix A): Core URL, tenant token, bell secret; and the templates: which
// installed set the site uses, and whether views render inside a shadow root
// (docs/default-templates.md). The page also shows the last successful sync, which an operator
// must be able to see (SRS §8), and the sets the update channel offers, each with one Install button.

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
    register_setting('core_client', 'core_client_template_set', ['type' => 'string', 'sanitize_callback' => 'sanitize_key']);
    register_setting('core_client', 'core_client_shadow_dom', ['type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean']);
    foreach (['for_sale', 'coming', 'sold'] as $list) {
        register_setting('core_client', "core_client_status_$list", ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field']);
    }
});

add_action('admin_init', function (): void {
    foreach (core_client_datatypes() as $datatype) {
        register_setting('core_client', "core_client_publish_$datatype", ['type' => 'string', 'sanitize_callback' => fn (mixed $value): string => (string) $value === '0' ? '0' : '1']);
    }
});

// One menu, Kowboy Estates, holds every post type (store.php: `show_in_menu`) and the settings (Patric, 2026-10-03).
add_action('admin_menu', function (): void {
    add_menu_page('Kowboy Estates', 'Kowboy Estates', 'edit_posts', 'core-client', 'core_client_settings_page', 'dashicons-admin-multisite', 25);
    add_submenu_page('core-client', 'Settings', 'Settings', 'manage_options', 'core-client', 'core_client_settings_page');
});

/**
 * The one line an administrator must see while this site is not syncing (Patric, 2026-09-18): not
 * linked, a licence that is not active, or a sync that failed. Null while all is well. The site
 * keeps showing what it has in every case; only the updates stop.
 */
function core_client_notice(): ?string
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return 'This site is not linked to Kowboy Core, so no listings are synced. Contact Kowboy to link it.';
    }
    $error = core_client_state('last_error');
    if ($error === null) {
        return null;
    }
    if (str_contains($error, 'http 401')) {
        return 'The Kowboy Core licence for this site is not active: the site keeps showing what it has, but nothing updates. Contact Kowboy.';
    }
    return "The last sync with Kowboy Core failed ($error). The site keeps showing what it has.";
}

add_action('admin_notices', function (): void {
    if (!current_user_can('manage_options')) {
        return;
    }
    $notice = core_client_notice();
    if ($notice === null) {
        return;
    }
    echo '<div class="notice notice-error"><p><strong>Kowboy Core:</strong> ' . esc_html($notice) . '</p></div>';
});

function core_client_settings_page(): void
{
    if (!current_user_can('manage_options')) {
        wp_die('Sorry, you are not allowed to manage these settings.');
    }
    $status = core_client_status();
    $sets = core_client_template_sets();
    $chosen = core_client_template_set();
    $available = core_client_available_sets();
    ?>
    <div class="wrap">
        <h1>Kowboy Core</h1>
        <?php if (isset($_GET['set-installed'])) : ?>
            <div class="notice notice-success"><p>The template set <?php echo esc_html(sanitize_key((string) $_GET['set-installed'])); ?> is installed and selected.</p></div>
        <?php endif; ?>
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

            <h2>Templates</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="core_client_template_set">Template set</label></th>
                    <td>
                        <select id="core_client_template_set" name="core_client_template_set">
                            <option value="">The theme's own templates</option>
                            <?php foreach ($sets as $set) : ?>
                                <option value="<?php echo esc_attr($set['slug']); ?>" <?php selected($chosen !== null && $chosen['slug'] === $set['slug']); ?>>
                                    <?php echo esc_html($set['name'] . ' ' . $set['version']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description">A template in the theme's <code>core/</code> folder overrides the set's copy; every other template follows the set's updates.</p>
                    </td>
                </tr>
                <?php foreach (['for_sale' => 'Status ids: for sale', 'coming' => 'Status ids: coming', 'sold' => 'Status ids: sold'] as $list => $label) : ?>
                    <tr>
                        <th scope="row"><label for="core_client_status_<?php echo esc_attr($list); ?>"><?php echo esc_html($label); ?></label></th>
                        <td><input type="text" id="core_client_status_<?php echo esc_attr($list); ?>" name="core_client_status_<?php echo esc_attr($list); ?>" class="regular-text"
                                   value="<?php echo esc_attr((string) get_option("core_client_status_$list", '')); ?>" placeholder="ids, comma-separated">
                            <?php if ($list === 'for_sale') : ?><p class="description">The CRM's status ids (<code>status.id</code> on a record) this site lists as for sale, as coming and as sold. The templates ask for <code>for_sale</code>, <code>coming</code> and <code>sold</code> and get these.</p><?php endif; ?></td>
                    </tr>
                <?php endforeach; ?>
            </table>

            <h2>Publishing</h2>
            <p class="description">What the site shows of each kind of record. Off, its pages answer 404, its archive is gone and every list of it is empty; the local copy and the sync go on as before.</p>
            <table class="form-table" role="presentation">
                <?php foreach (core_client_datatypes() as $datatype) : ?>
                    <tr>
                        <th scope="row"><label for="core_client_publish_<?php echo esc_attr($datatype); ?>"><?php echo esc_html(core_client_datatype_label($datatype)); ?></label></th>
                        <td><select id="core_client_publish_<?php echo esc_attr($datatype); ?>" name="core_client_publish_<?php echo esc_attr($datatype); ?>">
                                <option value="1" <?php selected(core_client_published($datatype)); ?>>Published</option>
                                <option value="0" <?php selected(!core_client_published($datatype)); ?>>Not published</option>
                            </select></td>
                    </tr>
                <?php endforeach; ?>
            </table>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">Shadow DOM</th>
                    <td><label><input type="checkbox" name="core_client_shadow_dom" value="1" <?php checked(core_client_shadow_dom()); ?>>
                        Render each view inside its own shadow root, so the theme's styles and the set's never mix.</label></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <h2>Template sets on offer</h2>
        <?php if ($available === []) : ?>
            <p>No update channel answers, so nothing is on offer. A set can still be uploaded as a plugin.</p>
        <?php else : ?>
            <table class="widefat striped" style="max-width: 40em">
                <?php foreach ($available as $offer) : ?>
                    <tr>
                        <th><?php echo esc_html($offer['name']); ?> <?php echo esc_html($offer['version']); ?></th>
                        <td>
                            <?php if (isset($sets[$offer['slug']])) : ?>
                                installed <?php echo esc_html($sets[$offer['slug']]['version']); ?>
                            <?php else : ?>
                                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                                    <?php wp_nonce_field('core_client_install_set'); ?>
                                    <input type="hidden" name="action" value="core_client_install_set">
                                    <input type="hidden" name="slug" value="<?php echo esc_attr($offer['slug']); ?>">
                                    <?php submit_button('Install', 'secondary', 'submit', false); ?>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </table>
        <?php endif; ?>

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
