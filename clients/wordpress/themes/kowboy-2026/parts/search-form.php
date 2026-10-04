<?php
// The search form of the Till salu page: four choices and a button, on the hero's lower edge.
// It sends its fields to the list on the same page by the address, as the list's filters read them.

declare(strict_types=1);

$max_prices = [1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 5000000, 6000000, 8000000, 10000000, 15000000];
$min_spaces = [30, 40, 50, 60, 70, 80, 90, 100, 120, 150];
$min_rooms = [1, 2, 3, 4, 5, 6];
$chosen = fn (string $key): string => isset($_GET[$key]) ? sanitize_text_field((string) $_GET[$key]) : '';
?>
<form class="k-search" method="get" action="">
    <label class="k-search__field"><span class="k-visually-hidden">Max pris</span>
        <select name="max_price"><option value="">Max pris</option>
            <?php foreach ($max_prices as $price) : ?><option value="<?php echo (int) $price; ?>" <?php selected($chosen('max_price'), (string) $price); ?>><?php echo esc_html(number_format($price, 0, ',', ' ') . ' kr'); ?></option><?php endforeach; ?>
        </select></label>
    <label class="k-search__field"><span class="k-visually-hidden">Minst boarea</span>
        <select name="min_living_space"><option value="">Minst boarea</option>
            <?php foreach ($min_spaces as $space) : ?><option value="<?php echo (int) $space; ?>" <?php selected($chosen('min_living_space'), (string) $space); ?>><?php echo (int) $space; ?> kvm</option><?php endforeach; ?>
        </select></label>
    <label class="k-search__field"><span class="k-visually-hidden">Minst antal rum</span>
        <select name="min_rooms"><option value="">Minst antal rum</option>
            <?php foreach ($min_rooms as $rooms) : ?><option value="<?php echo (int) $rooms; ?>" <?php selected($chosen('min_rooms'), (string) $rooms); ?>><?php echo (int) $rooms; ?> rum</option><?php endforeach; ?>
        </select></label>
    <label class="k-search__field"><span class="k-visually-hidden">Område</span>
        <input type="search" name="q" placeholder="Område" value="<?php echo esc_attr($chosen('q')); ?>"></label>
    <button class="k-button" type="submit">Sök</button>
</form>
