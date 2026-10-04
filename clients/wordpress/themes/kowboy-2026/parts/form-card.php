<?php
// The form card, dark: "Ska du sälja din bostad?" in the footer of every page and "Är du
// intresserad av bostaden?" on a property page, each a title, a text and one button that opens
// Core's form wizard (docs/forms.md, "The clients' part"; Patric, 2026-10-04: a button in place
// of the fields). The button carries the widget's marks, data-core-form and data-record, and on
// a page without the widget it leads to a contact instead: the agent's card, or the office's
// details in the footer.
//
// In scope: $title, $text, $label (the button's words), $form (lead or interest), $record
// (property:<connection>:<id>, or '' for a lead), $href (where the button leads without the widget).

declare(strict_types=1);
?>
<div class="k-lead">
    <div class="k-lead__intro">
        <h2 class="k-lead__title"><?php echo esc_html($title); ?></h2>
        <span class="k-lead__rule"></span>
        <?php if ($text !== '') : ?><p class="k-lead__text"><?php echo esc_html($text); ?></p><?php endif; ?>
    </div>
    <a class="k-button k-button--light k-lead__button" href="<?php echo esc_attr($href); ?>" data-core-form="<?php echo esc_attr($form); ?>"<?php echo $record === '' ? '' : ' data-record="' . esc_attr($record) . '"'; ?>><?php echo esc_html($label); ?></a>
</div>
