<?php
// The demo pages and the menus, made once when the theme is activated and a site has none of
// them: Hem (the front page), Till salu, Sålda bostäder, Om oss, each built from the section
// blocks with the design's own texts, word for word, and the two menus pointing at them.

declare(strict_types=1);

/** The menu when none is assigned: the demo pages, so a fresh site has a header. */
function kowboy_menu_fallback(array $args): void
{
    $items = '';
    foreach (['till-salu' => 'Till salu', 'salda-bostader' => 'Sålda bostäder', 'om-oss' => 'Om oss'] as $slug => $label) {
        $page = get_page_by_path($slug);
        $url = $page instanceof WP_Post ? (string) get_permalink($page) : home_url('/' . $slug . '/');
        $items .= '<li class="menu-item"><a href="' . esc_url($url) . '">' . esc_html($label) . '</a></li>';
    }
    // The footer's menu ends with the privacy page when the theme options name one.
    $privacy = (int) kowboy_option('kowboy_privacy_page');
    if (($args['theme_location'] ?? '') === 'footer' && $privacy > 0) {
        $items .= '<li class="menu-item"><a href="' . esc_url((string) get_permalink($privacy)) . '">' . esc_html(get_the_title($privacy)) . '</a></li>';
    }
    echo '<ul class="' . esc_attr((string) ($args['menu_class'] ?? '')) . '">' . $items . '</ul>';
}

add_action('after_switch_theme', function (): void {
    $pages = [
        'hem' => ['Hem', kowboy_demo_home()],
        'till-salu' => ['Till salu', kowboy_demo_for_sale()],
        'salda-bostader' => ['Sålda bostäder', kowboy_demo_sold()],
        'om-oss' => ['Om oss', kowboy_demo_about()],
    ];
    $ids = [];
    foreach ($pages as $slug => [$title, $content]) {
        $existing = get_page_by_path($slug);
        $ids[$slug] = $existing instanceof WP_Post ? $existing->ID : (int) wp_insert_post([
            'post_type' => 'page',
            'post_status' => 'publish',
            'post_name' => $slug,
            'post_title' => $title,
            'post_content' => $content,
        ]);
    }
    // The front page: Hem, unless the site already shows a page of its own that still exists.
    if (get_post((int) get_option('page_on_front')) === null && $ids['hem'] > 0) {
        update_option('show_on_front', 'page');
        update_option('page_on_front', $ids['hem']);
    }
    $menu = wp_get_nav_menu_object('Huvudmeny');
    if ($menu === false) {
        $menu_id = wp_create_nav_menu('Huvudmeny');
        if (!is_wp_error($menu_id)) {
            foreach (['till-salu', 'salda-bostader', 'om-oss'] as $slug) {
                wp_update_nav_menu_item($menu_id, 0, ['menu-item-object-id' => $ids[$slug], 'menu-item-object' => 'page', 'menu-item-type' => 'post_type', 'menu-item-status' => 'publish']);
            }
            set_theme_mod('nav_menu_locations', ['primary' => $menu_id, 'footer' => $menu_id]);
        }
    }
});

/** One block's markup as the editor stores it. */
function kowboy_block(string $name, array $attributes): string
{
    return '<!-- wp:kowboy/' . $name . ' ' . wp_json_encode($attributes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ' /-->' . "\n";
}

function kowboy_demo_lead_form(): string
{
    return kowboy_block('lead-form', ['title' => 'Ska du sälja din bostad?', 'text' => 'Fyll i dina uppgifter så hör vi av oss!']);
}

function kowboy_demo_home(): string
{
    return kowboy_block('page-hero', ['title' => 'Rätt timing ger bättre affärer', 'lead' => 'Vill du köpa eller sälja?', 'height' => 'tall', 'buttons' => [['label' => 'Till salu', 'url' => '/till-salu/'], ['label' => 'Sälj med oss', 'url' => '/om-oss/']]])
        . kowboy_block('intro', ['label' => 'Norban Mäkleri', 'title' => 'Vi vet vad som får ett hem att sälja', 'text' => 'Personlig rådgivning, lokal marknadskunskap och en process byggd för bästa möjliga resultat – oavsett om du köper eller säljer.', 'figures' => [['value' => '150+', 'label' => 'Sålda bostäder'], ['value' => '21 dagar', 'label' => 'Snitt till kontrakt'], ['value' => '4.9/5', 'label' => 'Kundbetyg'], ['value' => '15 år', 'label' => 'I branschen']]])
        . kowboy_block('agents', ['title' => 'Fastighetsmäklare', 'lead' => 'Vårt team – lokala experter som finns med dig hela vägen.', 'limit' => 2, 'cardLabel' => 'Om oss', 'cardTitle' => 'Möt teamet bakom varje affär', 'cardText' => 'Lär dig mer om vår historia, vårt arbetssätt och varför våra kunder väljer oss om och om igen.', 'cardButtonLabel' => 'Läs mer', 'cardButtonUrl' => '/om-oss/'])
        . kowboy_block('property-list', ['title' => 'Till salu', 'lead' => 'Nya bostäder varje vecka – bläddra bland allt till salu just nu.', 'status' => 'for_sale,coming', 'perPage' => 9, 'statusTabs' => true, 'filters' => false, 'background' => 'subtle'])
        . kowboy_demo_lead_form();
}

function kowboy_demo_for_sale(): string
{
    return kowboy_block('page-hero', ['title' => 'Hitta din nya bostad', 'lead' => "Här hittar du merparten av våra bostäder – både kommande försäljningar och objekt som är till salu just nu.\n\nSkulle du inte hitta det du söker är du alltid välkommen att höra av dig till oss, så skapar vi en personlig bevakning. Då får du mejl när en bostad som matchar dina kriterier dyker upp, oavsett om den säljs underhand, på förhand eller på den öppna marknaden.", 'searchForm' => true])
        . kowboy_block('property-list', ['status' => 'for_sale,coming', 'perPage' => 9, 'statusTabs' => true, 'filters' => false])
        . kowboy_demo_lead_form();
}

function kowboy_demo_sold(): string
{
    return kowboy_block('page-hero', ['title' => 'Genomförda affärer', 'lead' => 'Ett urval av våra genomförda försäljningar'])
        . kowboy_block('property-list', ['status' => 'sold', 'perPage' => 9, 'statusTabs' => false, 'filters' => false])
        . kowboy_demo_lead_form();
}

function kowboy_demo_about(): string
{
    return kowboy_block('page-hero', ['title' => 'En genomtänkt process från start till mål', 'lead' => 'Från första kontakt till tillträde – vi finns med dig i varje steg av din bostadsaffär.'])
        . kowboy_block('feature-list', ['text' => 'På Norban Mäkleri brinner vi för att skapa starka resultat och riktigt smidiga bostadsaffärer – med ett sammansvetsat team som vet hur man bygger tempo, träffsäkerhet och trygghet genom hela processen.', 'items' => [['title' => 'Försäljning innan Hemnet', 'text' => 'Vi matchar din bostad mot vårt spekulantregister och bygger tidigt tryck – cirka 40 % av våra affärer sker redan på förhand, ofta med bättre villkor.'], ['title' => 'Premiumtjänst från start', 'text' => 'Professionell fotografering, stilren annonsproduktion och digital marknadsföring – baserat på beprövade metoder för din lokala marknad.'], ['title' => 'Lokal närvaro, bred täckning', 'text' => 'Kontor i Malmö, men vi säljer i hela Malmö, Lund och kommunerna runt omkring – stark lokalkännedom var din bostad än ligger.']], 'closing' => 'Bjud hem oss eller slå en signal till någon av våra duktiga mäklare – så berättar vi gärna mer om hur vi kan optimera din försäljning, på ett sätt som passar just dig.'])
        . kowboy_block('agents', ['title' => 'Våra mäklare', 'limit' => 12])
        . kowboy_block('testimonials', ['title' => 'Omdömen från tidigare säljare vi har hjälpt genom hela försäljningsprocessen.', 'items' => [['quote' => 'Sara är professionell, engagerad och kunnig! Vi anlitade Sara för försäljningen av vår bostad och kunde inte vara mer nöjda. Från första mötet visade hon stor kunskap om marknaden, lyhördhet för våra önskemål och ett starkt engagemang. Kommunikation och återkoppling har varit tydlig och snabb genom hela processen, vilket har gjort att vi känt oss trygga från början till slut. Vi kan varmt rekommendera Sara till alla som vill ha en smidig och framgångsrik bostadsaffär.', 'author' => 'Säljare på Spannmålsgatan 50A'], ['quote' => 'Martina är fantastiskt duktig! Så proffsig, kunnig och korrekt (visste detta sedan tidigare då jag redan fått hjälp av henne en gång). Hon finns verkligen där för dig för att det ska bli så bra som möjligt. Är så bra på att uttrycka sig. Och rekommenderar henne gladeligen. Tack för fin hjälp!', 'author' => 'Säljare på Sankt Pauli Kyrkogata 14']]])
        . kowboy_demo_lead_form();
}
