<?php
// The `?debugpl` page (includes/debug.php): the record's `item` and `raw` in a JSON viewer
// (lib/json-viewer, @andypf/json-viewer, MIT), nothing of the theme around it.

declare(strict_types=1);

$core_client_post_id = (int) get_the_ID();
$core_client_views = [
    'item' => core_client_item($core_client_post_id),
    'raw' => core_client_item_raw($core_client_post_id),
];
nocache_headers();
?>
<!doctype html>
<html lang="<?php echo esc_attr(get_bloginfo('language')); ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title><?php echo esc_html(get_post_type() . ' ' . get_the_title() . ' · JSON'); ?></title>
    <style>
        body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, sans-serif; background: #f6f6f2; color: #111; }
        h1 { font-size: 18px; margin: 0 0 16px; }
        h2 { font-size: 14px; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
        a { color: inherit; }
        andypf-json-viewer { display: block; padding: 16px; border-radius: 12px; background: #fff; }
    </style>
</head>
<body>
    <h1><?php echo esc_html(get_post_type() . ' · ' . get_the_title()); ?> <small><a href="<?php echo esc_url((string) get_permalink()); ?>">till sidan</a></small></h1>
    <?php foreach ($core_client_views as $core_client_name => $core_client_value) : ?>
        <h2><?php echo esc_html($core_client_name); ?></h2>
        <andypf-json-viewer indent="2" expanded="2" show-data-types="false" show-toolbar="true" show-copy="true" show-size="true" theme="default-light"><?php echo esc_html((string) wp_json_encode($core_client_value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); ?></andypf-json-viewer>
    <?php endforeach; ?>
    <?php // The viewer reads each element's text when it is defined, so its script comes after the JSON: in the head, it saw the elements empty and showed nothing. ?>
    <script src="<?php echo esc_url(plugins_url('lib/json-viewer/json-viewer.js', CORE_CLIENT_FILE)); ?>"></script>
</body>
</html>
