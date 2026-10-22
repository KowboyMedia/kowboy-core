<?php
// The site's own agents and offices (Patric, 2026-10-03, question 125): records a site adds in
// its admin that no CRM carries. They live in the same post types and the same index as the
// CRM's, under the connection `site` with ids `s<post number>`, so every list, card and page
// sees both kinds through one path; a pull never names them, and the rebuild's sweep leaves them
// (includes/sync.php). A CRM record stays the CRM's: locked in the admin (includes/store.php),
// and the list's Source column and the edit screen say so.

declare(strict_types=1);

const CORE_CLIENT_SITE_NONCE = 'core_client_site_record';

/**
 * The id of a record the site typed itself: `s` and the post number, one token (`s12`), so the
 * address keeps the CRM records' pattern, `<name>-<id>`, with an id of its own structure that never
 * meets a CRM id (Patric, 2026-10-04).
 */
function core_client_site_id(int $post_id): string
{
    return 's' . $post_id;
}

/** What the admin says of a CRM record wherever someone could try to change it. */
function core_client_crm_record_notice(): string
{
    return 'This record comes from the CRM and is edited there. This site only shows it.';
}

/** Whose a record is, for the list tables' Source column. */
function core_client_source_label(int $post_id): string
{
    return core_client_is_crm_post($post_id) ? 'The CRM (edited there)' : 'This site';
}

// The portrait of the site's own agents is WordPress's featured image.
add_action('after_setup_theme', function (): void {
    add_theme_support('post-thumbnails', [core_client_post_type('agent')]);
}, 20);

// The form, on the site's own agents and offices only; a CRM record never reaches its edit screen.
add_action('add_meta_boxes', function (string $type, WP_Post $post): void {
    if (!str_starts_with($type, 'core_') || !core_client_site_datatype(substr($type, 5)) || core_client_is_crm_post($post->ID)) {
        return;
    }
    add_meta_box('core_site_record', $type === core_client_post_type('agent') ? 'Agent' : 'Office', 'core_client_site_form', $type, 'normal', 'high');
}, 10, 2);

/** The form of a record the site types itself: the fields the templates show, stored under the universal names. */
function core_client_site_form(WP_Post $post): void
{
    $item = core_client_item($post->ID) ?? [];
    $agent = $post->post_type === core_client_post_type('agent');
    wp_nonce_field(CORE_CLIENT_SITE_NONCE . $post->ID, 'core_site_nonce');
    echo '<p>' . esc_html($agent
        ? 'An agent this site adds itself, not from the CRM. The name is the title above, the portrait the featured image.'
        : 'An office this site adds itself, not from the CRM. The name is the title above.') . '</p>';
    echo '<table class="form-table" role="presentation">';
    if (!$agent) {
        core_client_site_field('address', 'Address, as shown', (string) ($item['display']['address_line'] ?? ''), 'One line, for example "Storgatan 1, 111 22 Stockholm".');
        core_client_site_field('phone', 'Phone', (string) ($item['phone']['display'] ?? ''), 'As it is to be shown.');
        core_client_site_field('email', 'E-mail', (string) ($item['email'] ?? ''));
        core_client_site_field('description', 'Description', (string) ($item['description'] ?? ''), '', true);
        echo '</table>';
        return;
    }
    core_client_site_field('title', 'Title', (string) ($item['title'] ?? ''), 'For example "Fastighetsmäklare".');
    core_client_site_field('email', 'E-mail', (string) ($item['email'] ?? ''));
    core_client_site_field('phone', 'Mobile phone', (string) ($item['phones']['mobile']['display'] ?? ''), 'As it is to be shown.');
    core_client_site_field('description', 'Description', (string) ($item['description'] ?? ''), '', true);
    $reviews = [];
    foreach (is_array($item['reviews'] ?? null) ? $item['reviews'] : [] as $review) {
        $author = is_string($review['author'] ?? null) && $review['author'] !== '' ? ' | ' . $review['author'] : '';
        $reviews[] = trim((string) ($review['text'] ?? '')) . $author;
    }
    core_client_site_field('reviews', 'Reviews', implode("\n", $reviews), 'One per line: the text, then a vertical bar and the author.', true);
    $visible = ($item['is_visible_in_staff_list'] ?? true) !== false;
    echo '<tr><th scope="row">Staff list</th><td><label><input type="checkbox" name="core_site[visible]" value="1"' . checked($visible, true, false) . '> Show in the staff list (the agents page, the home page)</label></td></tr>';
    $own = [];
    foreach (is_array($item['offices'] ?? null) ? $item['offices'] : [] as $office) {
        if (is_array($office) && is_string($office['office_id'] ?? null)) {
            $own[$office['office_id']] = $office;
        }
    }
    echo '<tr><th scope="row">Offices</th><td>';
    $offices = core_client_site_offices();
    if ($offices === []) {
        echo '<p>This site holds no office yet.</p>';
    }
    foreach ($offices as $office) {
        $key = 'core_site[offices][' . esc_attr($office['id']) . ']';
        $member = $own[$office['id']] ?? null;
        $order = is_array($member) && (is_int($member['order'] ?? null) || is_float($member['order'] ?? null)) ? (string) (int) $member['order'] : '';
        $listed = $member === null || ($member['is_visible_in_staff_list'] ?? true) !== false;
        echo '<p><label><input type="checkbox" name="' . $key . '[on]" value="1"' . checked($member !== null, true, false) . '> ' . esc_html($office['name']) . '</label>'
            . ' &nbsp; <label>Order <input type="number" name="' . $key . '[order]" value="' . esc_attr($order) . '" class="small-text" step="1"></label>'
            . ' &nbsp; <label><input type="checkbox" name="' . $key . '[visible]" value="1"' . checked($listed, true, false) . '> In this office\'s staff list</label></p>';
    }
    echo '<p class="description">The order number is the agent\'s place in the staff list, lowest first; an agent without a number comes after the numbered ones, by name.</p></td></tr>';
    echo '</table>';
}

/** One text field, or a text area, of the form. */
function core_client_site_field(string $key, string $label, string $value, string $help = '', bool $long = false): void
{
    $id = 'core_site_' . $key;
    $name = 'core_site[' . $key . ']';
    echo '<tr><th scope="row"><label for="' . esc_attr($id) . '">' . esc_html($label) . '</label></th><td>';
    echo $long
        ? '<textarea id="' . esc_attr($id) . '" name="' . esc_attr($name) . '" class="large-text" rows="5">' . esc_textarea($value) . '</textarea>'
        : '<input type="text" id="' . esc_attr($id) . '" name="' . esc_attr($name) . '" class="regular-text" value="' . esc_attr($value) . '">';
    if ($help !== '') {
        echo '<p class="description">' . esc_html($help) . '</p>';
    }
    echo '</td></tr>';
}

/**
 * Every office the site holds, CRM or its own, published or a draft, for the agent form: id and
 * name, by name. Straight from the index, not the site's list query: an office the site does not
 * show (its kind unpublished, a draft of the site's own) is still one an agent belongs to.
 *
 * @return list<array{id: string, name: string}>
 */
function core_client_site_offices(): array
{
    global $wpdb;
    $offices = [];
    $post_ids = $wpdb->get_col($wpdb->prepare(
        'SELECT i.post_id FROM ' . core_client_index_table() . " i JOIN {$wpdb->posts} p ON p.ID = i.post_id
         WHERE i.datatype = %s AND p.post_status IN ('publish', 'draft')",
        'office',
    ));
    foreach ($post_ids as $post_id) {
        $item = core_client_item((int) $post_id);
        $id = $item['id'] ?? null;
        if (is_string($id) && $id !== '') {
            $offices[] = ['id' => $id, 'name' => (string) ($item['name'] ?? $id)];
        }
    }
    usort($offices, fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
    return $offices;
}

foreach (['agent', 'office'] as $core_site_datatype) {
    add_action('save_post_' . core_client_post_type($core_site_datatype), 'core_client_save_site_record', 10, 2);
}
unset($core_site_datatype);

// The slug of a record the site types, set before the post is written (`erik-egen-s12`, by the
// one function every record's address comes from), so no second write follows the save.
add_filter('wp_insert_post_data', function (array $data, array $postarr): array {
    $post_id = (int) ($postarr['ID'] ?? 0);
    $datatype = substr((string) ($data['post_type'] ?? ''), 5);
    if ($post_id > 0 && str_starts_with((string) ($data['post_type'] ?? ''), 'core_') && core_client_site_datatype($datatype)
        && !core_client_is_crm_post($post_id) && !core_client_sync_writing()) {
        $name = (object) ['name' => wp_unslash((string) ($data['post_title'] ?? ''))];
        $data['post_name'] = core_client_slug($datatype, $name, core_client_site_id($post_id));
    }
    return $data;
}, 10, 2);

/**
 * Write a record the site typed itself: the universal record from the form, or from the title and
 * the portrait alone when the form was not sent (a quick edit, a status change, a post made some
 * other way), under the site's connection. Nothing happens for an autosave, for a post still being
 * added, for a CRM record, or for the sync's own writes.
 */
function core_client_save_site_record(int $post_id, WP_Post $post): void
{
    if (wp_is_post_autosave($post_id) || $post->post_status === 'auto-draft' || core_client_is_crm_post($post_id) || core_client_sync_writing()) {
        return;
    }
    $datatype = substr($post->post_type, 5);
    $submitted = isset($_POST['core_site_nonce'])
        && wp_verify_nonce((string) $_POST['core_site_nonce'], CORE_CLIENT_SITE_NONCE . $post_id) !== false
        && current_user_can('edit_post', $post_id);
    $fields = $submitted && is_array($_POST['core_site'] ?? null) ? (array) wp_unslash($_POST['core_site']) : null;
    $data = core_client_site_record($datatype, $post, $fields, core_client_item($post_id) ?? []);
    $json = (string) wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    core_client_store_record($post_id, $datatype, $json, 'null', [
        'connection_id' => core_client_site_connection(),
        'remote_id' => (string) $data['id'],
        'office_id' => $datatype === 'office' ? (string) $data['id'] : null,
        'seq' => 0,
        'content_hash' => hash('sha256', $json),
        'remote_updated_at' => null,
    ]);
    // A post made without an id to hand (wp post create): the slug the filter above could not set.
    $slug = core_client_slug($datatype, json_decode($json) ?: new stdClass(), (string) $data['id']);
    if ($post->post_name !== $slug) {
        remove_action('save_post_' . $post->post_type, 'core_client_save_site_record');
        wp_update_post(['ID' => $post_id, 'post_name' => $slug]);
        add_action('save_post_' . $post->post_type, 'core_client_save_site_record', 10, 2);
        clean_post_cache($post_id);
    }
}

/**
 * The universal record of an office or agent the site typed (schemas/office.v1.json,
 * schemas/agent.v1.json): the form's fields under the universal names, the rest of the shape
 * empty. Without the form (a quick edit, a status change) the stored record keeps its fields and
 * takes the title and the portrait as they are now.
 *
 * @param array<string, mixed>|null $fields
 * @param array<string, mixed> $stored
 * @return array<string, mixed>
 */
function core_client_site_record(string $datatype, WP_Post $post, ?array $fields, array $stored): array
{
    $name = trim($post->post_title);
    $head = ['id' => core_client_site_id($post->ID), 'name' => $name !== '' ? $name : null];
    if ($fields === null) {
        return $datatype === 'agent'
            ? [...$stored, ...$head, 'image' => core_client_site_image($post->ID)]
            : [...$stored, ...$head];
    }
    $text = static function (mixed $value): ?string {
        $value = trim((string) (is_scalar($value) ? $value : ''));
        return $value === '' ? null : $value;
    };
    if ($datatype === 'office') {
        $address = $text($fields['address'] ?? null);
        return [
            ...$head,
            'brand_id' => null,
            'address' => ['street' => null, 'postal_code' => null, 'city' => null],
            'phone' => core_client_site_phone((string) ($fields['phone'] ?? '')),
            'email' => $text($fields['email'] ?? null),
            'seat' => null,
            'description' => $text($fields['description'] ?? null),
            'lat' => null,
            'lng' => null,
            'display' => $address === null ? new stdClass() : ['address_line' => $address],
            'provider_extras' => new stdClass(),
        ];
    }
    $office_ids = [];
    $offices = [];
    foreach (is_array($fields['offices'] ?? null) ? $fields['offices'] : [] as $office_id => $office) {
        if (!is_array($office) || empty($office['on'])) {
            continue;
        }
        $order = trim((string) ($office['order'] ?? ''));
        $office_ids[] = (string) $office_id;
        $offices[] = [
            'office_id' => (string) $office_id,
            'order' => is_numeric($order) ? (int) $order : null,
            'is_visible_in_staff_list' => !empty($office['visible']),
            'phone' => null,
        ];
    }
    $reviews = [];
    foreach (preg_split('/\R/', (string) ($fields['reviews'] ?? '')) ?: [] as $line) {
        $parts = array_map('trim', explode('|', $line, 2));
        if ($parts[0] !== '') {
            $reviews[] = ['text' => $parts[0], 'author' => ($parts[1] ?? '') !== '' ? $parts[1] : null];
        }
    }
    return [
        ...$head,
        'office_ids' => $office_ids,
        'title' => $text($fields['title'] ?? null),
        'category' => null,
        'description' => $text($fields['description'] ?? null),
        'email' => $text($fields['email'] ?? null),
        'languages' => [],
        'phones' => ['mobile' => core_client_site_phone((string) ($fields['phone'] ?? '')), 'public' => null],
        'image' => core_client_site_image($post->ID),
        'is_visible_in_staff_list' => !empty($fields['visible']),
        'offices' => $offices,
        'reviews' => $reviews,
        'display' => new stdClass(),
        'provider_extras' => new stdClass(),
    ];
}

/**
 * A phone as typed: the display text as written, the number its digits with a leading plus kept.
 *
 * @return array{number: string, display: string}|null
 */
function core_client_site_phone(string $typed): ?array
{
    $typed = trim($typed);
    if ($typed === '') {
        return null;
    }
    $digits = (string) preg_replace('/\D/', '', $typed);
    return ['number' => (str_starts_with($typed, '+') ? '+' : '') . $digits, 'display' => $typed];
}

/**
 * The portrait, from the featured image, in the record's image shape; null without one.
 *
 * @return array<string, mixed>|null
 */
function core_client_site_image(int $post_id): ?array
{
    $attachment = (int) get_post_thumbnail_id($post_id);
    $url = $attachment > 0 ? wp_get_attachment_image_url($attachment, 'full') : false;
    if (!is_string($url) || $url === '') {
        return null;
    }
    $alt = get_post_meta($attachment, '_wp_attachment_image_alt', true);
    return [
        'id' => (string) $attachment,
        'url' => $url,
        'category' => null,
        'name' => get_the_title($attachment) !== '' ? get_the_title($attachment) : null,
        'description' => is_string($alt) && $alt !== '' ? $alt : null,
        'extension' => pathinfo($url, PATHINFO_EXTENSION) !== '' ? pathinfo($url, PATHINFO_EXTENSION) : null,
        'changed_at' => null,
        'order' => 1,
    ];
}

// The list tables: a Source column that says whose a record is, on every kind of record.
add_action('admin_init', function (): void {
    foreach (core_client_datatypes() as $datatype) {
        $type = core_client_post_type($datatype);
        add_filter("manage_{$type}_posts_columns", function (array $columns): array {
            return [...array_slice($columns, 0, 2, true), 'core_source' => 'Source', ...array_slice($columns, 2, null, true)];
        });
        add_action("manage_{$type}_posts_custom_column", function (string $column, int $post_id): void {
            if ($column === 'core_source') {
                echo esc_html(core_client_source_label($post_id));
            }
        }, 10, 2);
    }
});

// The line above every list of records: where each kind is edited.
add_action('admin_notices', function (): void {
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if ($screen === null || $screen->base !== 'edit' || !str_starts_with((string) $screen->post_type, 'core_')) {
        return;
    }
    $datatype = substr((string) $screen->post_type, 5);
    $text = 'Records from the CRM are shown here and edited in the CRM, never on this site.';
    if (core_client_site_datatype($datatype)) {
        $text .= ' ' . core_client_datatype_label($datatype) . ' this site adds itself ("This site" in the Source column) are edited here.';
    }
    echo '<div class="notice notice-info"><p><strong>Kowboy Core:</strong> ' . esc_html($text) . '</p></div>';
});

// The edit screen of a CRM record: a plain sentence instead of WordPress's "not allowed".
add_action('load-post.php', function (): void {
    $post_id = (int) ($_GET['post'] ?? 0);
    if ($post_id > 0 && str_starts_with((string) get_post_type($post_id), 'core_') && core_client_is_crm_post($post_id)) {
        wp_die(esc_html(core_client_crm_record_notice()), 'Kowboy Core', ['response' => 403, 'back_link' => true]);
    }
});
