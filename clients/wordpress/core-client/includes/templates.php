<?php
// Template sets and views (docs/default-templates.md, "The scaffolding"). A set is a WordPress
// plugin that registers itself here in one line. The site picks one set on the settings page. A
// view is looked up in the theme first (<theme>/core/<file>), then in the chosen set, so a copy
// in the theme is never touched by an update. The post types' single pages and archives route to
// those view files, one list function serves the shortcode, the archive page, the reload endpoint
// and PHP alike, and shadow DOM is one setting of the site. Nothing here formats a value: the
// views show `display` and `data` as the local copy holds them.

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

/** The site's shadow DOM setting: on until the site turns it off (Patric, 2026-09-28). */
function core_client_shadow_dom(): bool
{
    $option = get_option('core_client_shadow_dom', 'unset');
    return $option === 'unset' || (bool) $option;
}

/**
 * Wrap a rendered view: in a declarative shadow root with the set's stylesheet linked inside it
 * when the site asked for shadow DOM (or `$shadow` says so), in a plain division otherwise. A
 * list inside a single page passes `false` and never opens a second root.
 */
function core_client_wrap(string $html, ?bool $shadow = null): string
{
    if (!($shadow ?? core_client_shadow_dom())) {
        return '<div class="core-view">' . $html . '</div>';
    }
    $links = '';
    foreach ([core_client_set_asset('css', true), core_client_set_asset('css')] as $css) {
        $links .= $css === null ? '' : '<link rel="stylesheet" href="' . esc_url($css) . '">';
    }
    return '<core-view><template shadowrootmode="open">' . $links . $html . '</template></core-view>';
}

/**
 * The one list function: the shortcode, the archive page, the reload endpoint and any PHP call it
 * with one parameter set, passed through untouched to the query (includes/query.php) and to the
 * view. `part` = `cards` renders the cards alone, for a reload; otherwise the wrapper
 * `list-<entity>.php` with its first page rendered on the server.
 *
 * @param array<string, mixed> $params
 * @return array{html: string, total: int, has_more: bool, page: int}
 */
function core_client_list(array $params): array
{
    $params['entity'] = (string) ($params['entity'] ?? 'property');
    $result = core_client_query($params);
    $cards = '';
    foreach ($result['items'] as $row) {
        $cards .= core_client_render('card-' . $params['entity'] . '.php', [
            'post_id' => $row['post_id'],
            'item' => $row['item'],
            'params' => $params,
        ]);
    }
    if (($params['part'] ?? '') === 'cards') {
        $html = $cards;
    } else {
        $view = core_client_render('list-' . $params['entity'] . '.php', [
            'params' => $params,
            'result' => $result,
            'cards' => $cards,
        ]);
        $html = core_client_wrap($view, isset($params['shadow']) ? (bool) $params['shadow'] : null);
    }
    return ['html' => $html, 'total' => $result['total'], 'has_more' => $result['has_more'], 'page' => $result['page']];
}

/** `[core_list entity="property" status="ForSale,Coming" per_page="10"]`: the attributes are the parameter set. */
add_shortcode('core_list', function ($attributes): string {
    return core_client_list(is_array($attributes) ? $attributes : [])['html'];
});

/** The reload endpoint: `GET /wp-json/core/v1/list?<the parameter set>` answers the cards of one page. */
add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/list', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $request): array {
            return core_client_list($request->get_query_params() + ['part' => 'cards']);
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

/** The chosen set's stylesheet and script on every public page; the script also serves shadow roots. */
add_action('wp_enqueue_scripts', function (): void {
    $set = core_client_template_set();
    if ($set === null) {
        return;
    }
    if (!core_client_shadow_dom()) {
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
