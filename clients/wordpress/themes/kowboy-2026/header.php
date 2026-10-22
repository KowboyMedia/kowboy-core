<?php
// The page's head and the header: the logotype (bright over a hero, dark otherwise) and the main
// menu. The header lies over the hero on pages that open with one (body class k-has-hero).

declare(strict_types=1);
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="k-header">
    <div class="k-container k-header__row">
        <?php echo kowboy_logo(kowboy_has_hero()); ?>
        <button class="k-header__toggle" type="button" aria-expanded="false" aria-controls="k-menu" data-menu-toggle>
            <span class="k-visually-hidden">Meny</span>
            <span class="k-header__bar k-header__bar--top"></span><span class="k-header__bar k-header__bar--bottom"></span>
        </button>
        <nav class="k-header__nav" id="k-menu" aria-label="Huvudmeny">
            <?php wp_nav_menu(['theme_location' => 'primary', 'container' => false, 'menu_class' => 'k-menu', 'fallback_cb' => 'kowboy_menu_fallback', 'depth' => 1]); ?>
        </nav>
    </div>
</header>
<main class="k-main">
