<?php
// Template sets and views (docs/default-templates.md, "The scaffolding"). A set is a WordPress
// plugin that registers itself here in one line. The site picks one set on the settings page. A
// view is looked up in the theme first (<theme>/core/<file>), then in the chosen set, so a copy
// in the theme is never touched by an update. The post types' single pages and archives route to
// those view files, one list function serves the shortcode, the archive page, the reload endpoint
// and PHP alike, and style isolation (each view in its own shadow root) is one setting of the
// site. Nothing here formats a value: the views show `display` and `data` as the local copy holds
// them.

declare(strict_types=1);

/** @var array<string, array{slug: string, name: string, file: string, dir: string, version: string}> */
$GLOBALS['core_client_template_sets'] = [];

/**
 * The one line a set calls: a set plugin's main file on `plugins_loaded`, or a theme's
 * `functions.php`. `$file` is that file; its folder holds the views (a theme keeps them under
 * `core/`, where the override rule looks first), `assets/<slug>.css` and `assets/<slug>.js`, and
 * any `assets/vendor/<slug>-vendor.css` and `.js` the set brings.
 */
function core_client_register_template_set(string $slug, string $name, string $file, string $version): void
{
    $GLOBALS['core_client_template_sets'][$slug] = [
        'slug' => $slug,
        'name' => $name,
        'file' => $file,
        'dir' => dirname($file),
        'version' => $version,
    ];
}

/** @return array<string, array{slug: string, name: string, file: string, dir: string, version: string}> */
function core_client_template_sets(): array
{
    return $GLOBALS['core_client_template_sets'];
}

/**
 * The set the site chose, while it is installed and active. With none chosen: the set the active
 * theme is (a theme is the site's declared choice), else the one installed set, so activating a
 * set is enough. Null when there is none: a custom-design theme renders from the plugin's
 * functions on its own.
 *
 * @return array{slug: string, name: string, file: string, dir: string, version: string}|null
 */
function core_client_template_set(): ?array
{
    $sets = core_client_template_sets();
    $slug = (string) get_option('core_client_template_set', '');
    if ($slug !== '' && isset($sets[$slug])) {
        return $sets[$slug];
    }
    foreach ($sets as $set) {
        if (core_client_set_is_theme($set)) {
            return $set;
        }
    }
    return count($sets) === 1 ? reset($sets) : null;
}

/**
 * Whether a set is the active theme (its folder is the theme's, symbolic links resolved).
 *
 * @param array{slug: string, name: string, file: string, dir: string, version: string} $set
 */
function core_client_set_is_theme(array $set): bool
{
    $theme = realpath(get_stylesheet_directory());
    $dir = realpath($set['dir']);
    return $theme !== false && $dir !== false && $dir === $theme;
}

/** The override rule: the theme's copy wins (`<theme>/core/<file>`), then the chosen set's file. */
function core_client_template(string $file): ?string
{
    $theme = locate_template(['core/' . $file]);
    if ($theme !== '') {
        return $theme;
    }
    $set = core_client_template_set();
    if ($set !== null && is_file($set['dir'] . '/' . $file)) {
        return $set['dir'] . '/' . $file;
    }
    return null;
}

/**
 * Render one view file with these variables in its scope, and hand back its output. An empty
 * string when neither the theme nor the set has the file.
 *
 * @param array<string, mixed> $vars
 */
function core_client_render(string $file, array $vars = []): string
{
    $path = core_client_template($file);
    if ($path === null) {
        return '';
    }
    $render = static function (string $core_client_view_path, array $core_client_view_vars): string {
        extract($core_client_view_vars, EXTR_SKIP);
        ob_start();
        include $core_client_view_path;
        return (string) ob_get_clean();
    };
    return $render($path, $vars);
}

/**
 * The address of a set's stylesheet or script (`assets/<slug>.css`), or of what it vendors
 * (`assets/vendor/<slug>-vendor.css`), or null when the set has none.
 */
function core_client_set_asset(string $extension, bool $vendor = false): ?string
{
    $set = core_client_template_set();
    if ($set === null) {
        return null;
    }
    $relative = $vendor ? 'assets/vendor/' . $set['slug'] . '-vendor.' . $extension : 'assets/' . $set['slug'] . '.' . $extension;
    if (!is_file($set['dir'] . '/' . $relative)) {
        return null;
    }
    $url = core_client_set_is_theme($set)
        ? get_stylesheet_directory_uri() . '/' . $relative
        : plugins_url($relative, $set['file']);
    return add_query_arg('ver', $set['version'], $url);
}

/**
 * The site's style isolation: each view in its own shadow root, so the theme's styles and the
 * set's never mix. Off until the site turns it on (Patric, 2026-10-16, who renamed "shadow DOM",
 * on by default until then, and turned it off by default).
 */
function core_client_styleisolation(): bool
{
    return filter_var(get_option('core_client_styleisolation', false), FILTER_VALIDATE_BOOLEAN);
}

/**
 * Wrap a rendered view: in a declarative shadow root with the set's stylesheet linked inside it
 * when the site turned style isolation on (or `$isolate` says so), in a plain division otherwise.
 * A list inside a single page passes `false` and never opens a second root.
 */
function core_client_wrap(string $html, ?bool $isolate = null): string
{
    if (!($isolate ?? core_client_styleisolation())) {
        return '<div class="core-view">' . $html . '</div>';
    }
    // The search box's stylesheets first (includes/place-search.php), so the set's rules win over them.
    $links = '';
    foreach (core_client_place_search_used() ? core_client_place_search_css() : [] as $css) {
        $links .= '<link rel="stylesheet" href="' . esc_url($css) . '">';
    }
    foreach ([core_client_set_asset('css', true), core_client_set_asset('css')] as $css) {
        $links .= $css === null ? '' : '<link rel="stylesheet" href="' . esc_url($css) . '">';
    }
    return '<core-view><template shadowrootmode="open">' . $links . $html . '</template></core-view>';
}

/**
 * The one list function: the shortcode, the archive page, the reload endpoint and any PHP call it
 * with one parameter set, passed through untouched to the query (includes/query.php) and to the
 * views. `part` = `cards` renders the cards alone, for a reload; otherwise the wrapper with its
 * first page rendered on the server. `wrapper` and `card` choose the two views by name
 * (core_client_list_view); `styleisolation` (`1` or `0`) stands over the site's setting for this
 * list alone.
 *
 * @param array<string, mixed> $params
 * @return array{html: string, total: int, has_more: bool, page: int}
 */
function core_client_list(array $params): array
{
    // A view file's name is built from the entity too, so it keeps only what a name may hold.
    $params['entity'] = sanitize_key((string) ($params['entity'] ?? 'property'));
    $result = core_client_query($params);
    $card = core_client_list_view('card', $params['card'] ?? null, $params['entity']);
    $cards = '';
    foreach ($result['items'] as $row) {
        $cards .= core_client_render($card, [
            'post_id' => $row['post_id'],
            'item' => $row['item'],
            'params' => $params,
        ]);
    }
    if (($params['part'] ?? '') === 'cards') {
        $html = $cards;
    } else {
        $view = core_client_render(core_client_list_view('list', $params['wrapper'] ?? null, $params['entity']), [
            'params' => $params,
            'result' => $result,
            'cards' => $cards,
        ]);
        $isolate = isset($params['styleisolation']) ? filter_var($params['styleisolation'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) : null;
        $html = core_client_wrap($view, $isolate);
    }
    return ['html' => $html, 'total' => $result['total'], 'has_more' => $result['has_more'], 'page' => $result['page']];
}

/**
 * The view a list renders for its wrapper (`list`) or for each card (`card`): `<kind>-<name>.php`
 * for the name the list gives (Patric, 2026-10-16: `wrapper="homepage" card="homepage"` for
 * `list-homepage.php` and `card-homepage.php`), found by the override rule; the entity's own,
 * `<kind>-<entity>.php`, without a name or when no such file exists, as WordPress's template
 * parts fall back. A name keeps only lower-case letters, digits, `-` and `_` (sanitize_key), so
 * whoever sends it, through the reload endpoint too, it can only name a view of that kind.
 */
function core_client_list_view(string $kind, mixed $name, string $entity): string
{
    $name = is_scalar($name) ? sanitize_key((string) $name) : '';
    return $name !== '' && core_client_template("$kind-$name.php") !== null ? "$kind-$name.php" : "$kind-$entity.php";
}

/** `[core_list entity="property" status="for_sale,coming" per_page="10" card="homepage"]`: the attributes are the parameter set. */
add_shortcode('core_list', function ($attributes): string {
    return core_client_list(is_array($attributes) ? $attributes : [])['html'];
});

/** The reload endpoint: `GET /wp-json/core/v1/list?<the parameter set>` answers the cards of one page. */
add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/list', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $request): WP_REST_Response {
            $started = microtime(true);
            $result = core_client_list($request->get_query_params() + ['part' => 'cards']);
            $response = new WP_REST_Response($result);
            // A page may hold the answer for a minute (the cards change by the sync, seldom within a minute),
            // and the browser's timing panel shows what the list itself took, apart from WordPress's start.
            $response->header('Cache-Control', 'public, max-age=60');
            $response->header('Server-Timing', sprintf('list;dur=%.1f', (microtime(true) - $started) * 1000));
            return $response;
        },
    ]);
});

/** The single pages and archives of the post types render through the view files, when a view exists. */
add_filter('template_include', function (string $template): string {
    if (is_singular()) {
        $type = (string) get_post_type();
        $view = "single-$type.php";
    } elseif (is_post_type_archive()) {
        $type = (string) get_query_var('post_type');
        $view = "archive-$type.php";
    } else {
        return $template;
    }
    if (!str_starts_with($type, 'core_') || core_client_template($view) === null) {
        return $template;
    }
    $GLOBALS['core_client_view'] = $view;
    return __DIR__ . '/view-page.php';
});

/**
 * The chosen set's script on every public page, where it also serves the shadow roots, and its
 * stylesheet there too unless style isolation is on (a root links it inside).
 */
add_action('wp_enqueue_scripts', function (): void {
    $set = core_client_template_set();
    if ($set === null) {
        return;
    }
    if (!core_client_styleisolation()) {
        foreach (['vendor' => core_client_set_asset('css', true), 'set' => core_client_set_asset('css')] as $name => $css) {
            if ($css !== null) {
                wp_enqueue_style("core-client-$name", $css, [], null);
            }
        }
    }
    $vendor = core_client_set_asset('js', true);
    if ($vendor !== null) {
        wp_enqueue_script('core-client-vendor', $vendor, [], null, ['in_footer' => true]);
    }
    $js = core_client_set_asset('js');
    if ($js !== null) {
        wp_enqueue_script('core-client-set', $js, $vendor === null ? [] : ['core-client-vendor'], null, ['in_footer' => true]);
    }
});
