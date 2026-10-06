<?php
// The form card, dark: "Ska du sälja din bostad?" in the footer of every page and "Är du
// intresserad av bostaden?" on a property page, each a title, a text and one button (Patric,
// 2026-10-04: a button in place of the fields). The button is marked data-k-form and opens the
// theme's window (parts/form-window.php); without the window, it leads to a contact instead: the
// agent's card, or the office's details in the footer.
//
// In scope: $title, $text, $label (the button's words), $form (lead or interest), $record
// (property:<connection>:<id>, or '' for a lead), $href (where the button leads otherwise), and
// $home (the home's street, shown in the window's heading; '' or unset for a lead).

declare(strict_types=1);

$home = $home ?? '';
$marks = ' data-k-form="' . esc_attr($form) . '"';
if ($record !== '') {
    $marks .= ' data-record="' . esc_attr($record) . '"';
}
if ($home !== '') {
    $marks .= ' data-home="' . esc_attr($home) . '"';
}
?>
<div class="k-lead">
    <div class="k-lead__intro">
        <h2 class="k-lead__title"><?php echo esc_html($title); ?></h2>
        <span class="k-lead__rule"></span>
        <?php if ($text !== '') : ?><p class="k-lead__text"><?php echo esc_html($text); ?></p><?php endif; ?>
    </div>
    <a class="k-button k-button--light k-lead__button" href="<?php echo esc_attr($href); ?>"<?php echo $marks; ?>><?php echo esc_html($label); ?></a>
</div>
