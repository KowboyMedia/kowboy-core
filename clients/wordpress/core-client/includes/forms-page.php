<?php
// The page "Formulär" under Kowboy Estates (decision of 2026-10-05 on question 146, item 2; the
// decision of 2026-10-07 on the details kept on the site): the switch that turns the site's forms
// on, and every form the site sent in the last 30 days, delivered or not, with what the visitor
// wrote and what became of it, and "Skicka igen" beside one that did not reach the brokerage.
// Only an administrator sees it, since it holds the visitors' details. The words are Swedish, as
// the brokerage's staff read them.

declare(strict_types=1);

/** Forms shown on one page of the list. */
const CORE_CLIENT_FORMS_PER_PAGE = 50;

add_action('admin_menu', function (): void {
    add_submenu_page('core-client', 'Formulär', 'Formulär', 'manage_options', 'core-client-forms', 'core_client_forms_page');
}, 11);

add_action('admin_post_core_client_forms_on', function (): void {
    if (!current_user_can('manage_options')) {
        wp_die('Du får inte ändra formulären.');
    }
    check_admin_referer('core_client_forms_on');
    update_option('core_client_forms_on', isset($_POST['forms_on']) ? '1' : '0');
    wp_safe_redirect(admin_url('admin.php?page=core-client-forms&saved=1'));
    exit;
});

add_action('admin_post_core_client_form_again', function (): void {
    if (!current_user_can('manage_options')) {
        wp_die('Du får inte skicka formulär.');
    }
    check_admin_referer('core_client_form_again');
    $outcome = core_client_forms_again(sanitize_text_field((string) ($_POST['id'] ?? '')));
    wp_safe_redirect(admin_url('admin.php?page=core-client-forms&again=' . rawurlencode($outcome)));
    exit;
});

/**
 * "Skicka igen": the kept form once more to Core, as the window sent it and under its id, marked
 * as the site's own send, which needs no bot proof since no visitor is behind it. Core sends a form
 * the CRM did not take once more, answers a taken one as before, and sends one it never got as
 * new. Returns the outcome, or `gone` when the site no longer keeps the form and `busy` when Core
 * refused before it judged the form (the limit per minute).
 */
function core_client_forms_again(string $id): string
{
    global $wpdb;
    $table = core_client_forms_table();
    $row = $wpdb->get_row($wpdb->prepare("SELECT body FROM $table WHERE id = %s", $id));
    $form = is_object($row) ? json_decode((string) $row->body) : null;
    if (!($form instanceof stdClass)) {
        return 'gone';
    }
    $answer = core_client_forms_send((string) $row->body, ['X-Core-Resend' => 'yes']);
    if (in_array($answer->get_status(), [403, 429], true)) {
        return 'busy';
    }
    core_client_forms_keep($form, (string) $row->body, $answer);
    return core_client_forms_outcome($answer->get_status(), (array) $answer->get_data())[0];
}

/** What became of a form, in the words of the page. */
function core_client_forms_outcome_text(string $outcome, string $said): string
{
    return match ($outcome) {
        'delivered' => 'Kom fram till mäklaren.',
        'held' => 'Testläge: stoppades före mäklarsystemet, så mäklaren fick det inte.',
        'refused' => 'Mäklarsystemet tog inte emot det' . ($said !== '' ? ': ' . $said : '.') . ' Kowboy har fått veta det.',
        'crm' => 'Kom inte fram: mäklarsystemet svarade inte. Kowboy har fått veta det.',
        'check' => 'Kom inte fram: robotkontrollen fungerade inte. Kowboy har fått veta det.',
        'unreachable' => 'Kom inte fram: webbplatsen nådde inte Kowboy Core.',
        'unlinked' => 'Kom inte fram: webbplatsen är inte kopplad till Kowboy Core.',
        'off' => 'Kom inte fram: formulären var avstängda.',
        default => 'Kom inte fram: Kowboy Core tog inte emot det' . ($said !== '' ? ' (' . $said . ')' : '') . '.',
    };
}

/** The forms by their Swedish names. */
function core_client_forms_kind_text(string $kind): string
{
    return match ($kind) {
        'interest' => 'Intresseanmälan',
        'viewing' => 'Visningsbokning',
        'lead' => 'Värdering',
        'search_profile' => 'Sökprofil',
        default => $kind,
    };
}

/** The home a form is about, by its street and linked to its page, or '' for none. */
function core_client_forms_home(stdClass $form): string
{
    $record = $form->record ?? null;
    if (!($record instanceof stdClass) || !is_string($record->remote_id ?? null)) {
        return '';
    }
    $row = core_client_index_row((string) ($record->datatype ?? 'property'), (string) ($record->connection_id ?? ''), $record->remote_id);
    if ($row === null) {
        return esc_html($record->remote_id);
    }
    $item = core_client_item((int) $row->post_id) ?? [];
    $street = (string) ($item['address']['street'] ?? '');
    return '<a href="' . esc_url((string) get_permalink((int) $row->post_id)) . '">' . esc_html($street !== '' ? $street : $record->remote_id) . '</a>';
}

/** What the visitor wrote: name, mobile, e-mail, the message and the choices, escaped for the page. */
function core_client_forms_person(stdClass $form): string
{
    $person = $form->person ?? new stdClass();
    $text = static fn (mixed $value): string => is_string($value) ? $value : '';
    $lines = [
        esc_html(trim($text($person->first_name ?? null) . ' ' . $text($person->last_name ?? null))),
        '<a href="tel:' . esc_attr($text($person->phone ?? null)) . '">' . esc_html($text($person->phone ?? null)) . '</a>',
        '<a href="mailto:' . esc_attr($text($person->email ?? null)) . '">' . esc_html($text($person->email ?? null)) . '</a>',
    ];
    if ($text($form->message ?? null) !== '') {
        $lines[] = nl2br(esc_html($text($form->message)));
    }
    if (($form->contact_about_current_home ?? false) === true) {
        $lines[] = 'Vill bli kontaktad om sin nuvarande bostad.';
    }
    $criteria = $form->criteria ?? null;
    if ($criteria instanceof stdClass) {
        $wish = [];
        if (is_int($criteria->rooms_min ?? null)) {
            $wish[] = 'minst ' . $criteria->rooms_min . ' rum';
        }
        if (is_int($criteria->living_area_min ?? null)) {
            $wish[] = 'minst ' . $criteria->living_area_min . ' kvm';
        }
        foreach ((array) ($criteria->areas ?? []) as $area) {
            if ($area instanceof stdClass && is_string($area->name ?? null)) {
                $wish[] = $area->name;
            }
        }
        if ($wish !== []) {
            $lines[] = 'Söker: ' . esc_html(implode(', ', $wish)) . '.';
        }
    }
    return implode('<br>', $lines);
}

function core_client_forms_page(): void
{
    global $wpdb;
    if (!current_user_can('manage_options')) {
        wp_die('Du får inte se formulären.');
    }
    $table = core_client_forms_table();
    core_client_forms_purge();
    $page = max(1, (int) ($_GET['paged'] ?? 1));
    $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table");
    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table ORDER BY sent_at DESC, id LIMIT %d OFFSET %d",
        CORE_CLIENT_FORMS_PER_PAGE,
        ($page - 1) * CORE_CLIENT_FORMS_PER_PAGE,
    ));
    $again = sanitize_key((string) ($_GET['again'] ?? ''));
    ?>
    <div class="wrap">
        <h1>Formulär</h1>
        <?php if (isset($_GET['saved'])) : ?>
            <div class="notice notice-success"><p>Sparat. Formulären är <?php echo core_client_forms_on() ? 'på' : 'avstängda'; ?>.</p></div>
        <?php endif; ?>
        <?php if ($again === 'delivered') : ?>
            <div class="notice notice-success"><p>Formuläret kom fram till mäklaren.</p></div>
        <?php elseif ($again === 'gone') : ?>
            <div class="notice notice-error"><p>Formuläret finns inte kvar här, så det skickades inte.</p></div>
        <?php elseif ($again === 'busy') : ?>
            <div class="notice notice-error"><p>Kowboy Core tar emot för många formulär just nu, så det skickades inte. Försök igen om en minut.</p></div>
        <?php elseif ($again !== '') : ?>
            <div class="notice notice-error"><p>Formuläret skickades igen men kom inte fram. Raden nedan säger varför.</p></div>
        <?php endif; ?>

        <h2>Formulären på webbplatsen</h2>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <?php wp_nonce_field('core_client_forms_on'); ?>
            <input type="hidden" name="action" value="core_client_forms_on">
            <p><label><input type="checkbox" name="forms_on" value="1" <?php checked(core_client_forms_on()); ?>> Formulären är på</label></p>
            <p class="description">På öppnar knapparna Anmäl intresse, Boka här och Boka fri värdering ett formulär som skickas till mäklarsystemet. Avstängda leder knapparna till mäklarens kontaktuppgifter i stället.</p>
            <p><?php submit_button('Spara', 'primary', 'submit', false); ?> <span class="description">Sparar valet ovan; det gäller från nästa sida en besökare öppnar.</span></p>
        </form>

        <h2>Skickade formulär</h2>
        <p class="description">Varje formulär som webbplatsen har skickat de senaste <?php echo (int) CORE_CLIENT_FORMS_KEPT_DAYS; ?> dagarna, med det besökaren skrev och hur det gick, nyast först. Efter <?php echo (int) CORE_CLIENT_FORMS_KEPT_DAYS; ?> dagar raderas det. Ett formulär som inte kom fram kan skickas igen när felet är åtgärdat: "Skicka igen" skickar det en gång till med samma uppgifter, och ett som redan har kommit fram skickas inte två gånger.</p>
        <?php if ($rows === []) : ?>
            <p>Inga formulär de senaste <?php echo (int) CORE_CLIENT_FORMS_KEPT_DAYS; ?> dagarna.</p>
        <?php else : ?>
            <table class="widefat striped">
                <thead><tr><th>Skickat</th><th>Formulär</th><th>Bostad</th><th>Besökaren</th><th>Hur det gick</th></tr></thead>
                <tbody>
                <?php foreach ($rows as $row) : ?>
                    <?php $form = json_decode((string) $row->body); ?>
                    <?php if (!($form instanceof stdClass)) {
                        continue;
                    } ?>
                    <tr data-form="<?php echo esc_attr((string) $row->id); ?>">
                        <td><?php echo esc_html(wp_date('j M Y H:i', (int) strtotime($row->sent_at . ' UTC'))); ?></td>
                        <td><?php echo esc_html(core_client_forms_kind_text((string) $row->kind)); ?></td>
                        <td><?php echo core_client_forms_home($form); ?></td>
                        <td><?php echo core_client_forms_person($form); ?></td>
                        <td>
                            <?php echo esc_html(core_client_forms_outcome_text((string) $row->outcome, (string) $row->said)); ?>
                            <?php if ((int) $row->tries > 1) : ?><br><span class="description">Skickat <?php echo (int) $row->tries; ?> gånger, senast <?php echo esc_html(wp_date('j M H:i', (int) strtotime($row->last_at . ' UTC'))); ?>.</span><?php endif; ?>
                            <?php if (!in_array($row->outcome, ['delivered', 'held'], true)) : ?>
                                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                                    <?php wp_nonce_field('core_client_form_again'); ?>
                                    <input type="hidden" name="action" value="core_client_form_again">
                                    <input type="hidden" name="id" value="<?php echo esc_attr((string) $row->id); ?>">
                                    <p><?php submit_button('Skicka igen', 'secondary', 'submit', false); ?> <span class="description">Skickar det en gång till, med samma uppgifter.</span></p>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php echo wp_kses_post((string) paginate_links([
                'base' => add_query_arg('paged', '%#%'),
                'format' => '',
                'current' => $page,
                'total' => (int) ceil($total / CORE_CLIENT_FORMS_PER_PAGE),
            ])); ?>
        <?php endif; ?>
    </div>
    <?php
}
