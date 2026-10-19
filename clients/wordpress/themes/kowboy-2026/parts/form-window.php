<?php
// The form window (docs/forms.md, "Built 2026-10-06: the first version"; the look approved
// 2026-10-05): one dialog in the page for the three forms, opened by a button marked data-k-form
// and filled per form by the script (assets/kowboy-2026.js, setupFormWindow). A booking starts
// with its times, then the person's step, then the answer; an interest and a free valuation start
// with the person. The window talks only to the plugin's receivers on this site, never to Core,
// so the page holds no key but the bot check's public one. Every word the visitor reads is here
// or in the script; none names a system. After the main form is sent, every form ends with the
// optional step "Söker du bostad?" (docs/forms.md, the wizard), a second form of its own: the
// minimum rooms and living space, from the whitelist below, prefilled from the home. A form that
// cannot be sent is not sent again: the window says so and names whom to contact instead, the
// home's agent or the site (data-contact; Patric, 2026-10-19).
//
// In scope: $endpoint (the plugin's receiver for a form), $slots (its receiver for a viewing's
// times), $policy (the privacy policy's address, or '') and $human (the bot check's provider and
// public key from Core, or null for none).

declare(strict_types=1);

$human = $human ?? null;
// The search profile's whitelist (docs/forms.md, the whitelisted fields); Core takes nothing else.
$rooms = range(1, 7);
$living_areas = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 160, 170, 180, 200, 250];
?>
<dialog class="k-form" data-endpoint="<?php echo esc_attr($endpoint); ?>" data-slots="<?php echo esc_attr($slots); ?>" data-contact="<?php echo esc_attr((string) wp_json_encode(kowboy_contact())); ?>"<?php if (is_array($human) && $human['provider'] === 'turnstile') : ?> data-human-key="<?php echo esc_attr($human['site_key']); ?>"<?php endif; ?> aria-labelledby="k-form-title">
    <div class="k-form__modal">
        <div class="k-form__top" data-form-top>
            <div>
                <h2 class="k-form__title" id="k-form-title" data-form-title></h2>
                <p class="k-form__sub" data-form-subtitle></p>
            </div>
            <button class="k-form__text-button" type="button" data-form-close>Stäng</button>
        </div>
        <div class="k-form__progress" data-form-progress aria-hidden="true" hidden></div>
        <p class="k-form__sub" data-form-loading hidden>Hämtar…</p>

        <form class="k-form__step" data-form-step="slot" novalidate hidden>
            <div class="k-form__eyebrow">Välj tid</div>
            <div class="k-form__slots" data-form-slots role="radiogroup" aria-label="Välj tid"></div>
            <p class="k-form__sub" data-form-no-times hidden>Det finns inga tider att boka just nu. Kontakta mäklaren så hjälper vi dig.</p>
            <p class="k-form__error" data-form-slot-error hidden>Välj en tid för att gå vidare.</p>
            <div class="k-form__row"><span></span><button class="k-button" type="submit" data-form-next>Fortsätt</button></div>
        </form>

        <form class="k-form__step" data-form-step="person" novalidate hidden>
            <div class="k-form__eyebrow">Dina uppgifter</div>
            <div class="k-form__grid">
                <label class="k-form__label"><span>Förnamn</span><input class="k-form__field" name="first_name" autocomplete="given-name" maxlength="200" required></label>
                <label class="k-form__label"><span>Efternamn</span><input class="k-form__field" name="last_name" autocomplete="family-name" maxlength="200" required></label>
                <label class="k-form__label"><span>Mobil</span><input class="k-form__field" name="phone" type="tel" autocomplete="tel" maxlength="40" required></label>
                <label class="k-form__label"><span>E-post</span><input class="k-form__field" name="email" type="email" autocomplete="email" maxlength="320" required></label>
            </div>
            <label class="k-form__label"><span>Meddelande (valfritt)</span><textarea class="k-form__field" name="message" maxlength="4000"></textarea></label>
            <label class="k-form__consent"><input type="checkbox" name="consent" required><span>Jag samtycker till att mäklaren kontaktar mig och behandlar mina uppgifter enligt <?php if ($policy !== '') : ?><a href="<?php echo esc_url($policy); ?>" target="_blank" rel="noopener">integritetspolicyn</a><?php else : ?>integritetspolicyn<?php endif; ?>.</span></label>
            <p class="k-form__hint" data-form-remembered hidden>Vi minns dina uppgifter från förra gången i den här webbläsaren. <button class="k-form__text-button" type="button" data-form-forget>Glöm mig</button></p>
            <p class="k-form__error" data-form-error hidden>Fyll i alla fält och godkänn integritetspolicyn.</p>
            <div class="k-form__row"><span></span><button class="k-button" type="submit" data-form-send>Skicka</button></div>
        </form>

        <form class="k-form__step" data-form-step="profile" novalidate hidden>
            <div class="k-form__next">
                <div class="k-form__eyebrow" data-form-profile-step></div>
                <h3 class="k-form__heading">Söker du bostad?</h3>
                <p class="k-form__sub">Berätta vad du letar efter, så får du tips om nya bostäder som passar. Du kan hoppa över det här steget.</p>
            </div>
            <div class="k-form__grid">
                <label class="k-form__label"><span>Minst antal rum</span><select class="k-form__field" name="rooms_min"><option value="">Inget krav</option><?php foreach ($rooms as $value) : ?><option value="<?php echo esc_attr((string) $value); ?>"><?php echo esc_html($value . ' rum'); ?></option><?php endforeach; ?></select></label>
                <label class="k-form__label"><span>Minst boarea (kvm)</span><select class="k-form__field" name="living_area_min"><option value="">Inget krav</option><?php foreach ($living_areas as $value) : ?><option value="<?php echo esc_attr((string) $value); ?>"><?php echo esc_html($value . ' kvm'); ?></option><?php endforeach; ?></select></label>
            </div>
            <?php // On an interest and a booking: the visitor may be a seller too, which the brokerage hears with the profile. ?>
            <label class="k-form__consent" data-form-current-home><input type="checkbox" name="current_home"><span>Kontakta mig om min nuvarande bostad.</span></label>
            <p class="k-form__error" data-form-profile-error hidden></p>
            <div class="k-form__row">
                <button class="k-form__text-button" type="button" data-form-skip>Hoppa över</button>
                <button class="k-button" type="submit" data-form-profile-send>Skicka</button>
            </div>
        </form>

        <div class="k-form__step" data-form-step="end" hidden>
            <div class="k-form__big" data-form-end-title></div>
            <p class="k-form__sub" data-form-end-text></p>
            <div class="k-form__row"><span></span><button class="k-button" type="button" data-form-finish>Klart</button></div>
        </div>

        <div class="k-form__step" data-form-step="fail" hidden>
            <div class="k-form__big" data-form-fail-title></div>
            <p class="k-form__sub" data-form-fail-text></p>
            <p class="k-form__sub" data-form-elsewhere hidden></p>
            <div class="k-form__row">
                <button class="k-form__text-button" type="button" data-form-back hidden>Tillbaka</button>
                <button class="k-button" type="button" data-form-retry>Försök igen</button>
                <button class="k-button" type="button" data-form-dismiss hidden>Stäng</button>
            </div>
        </div>

        <?php // The bot check's challenge, which shows itself only when it needs the visitor; each send earns its own proof. ?>
        <div class="k-form__human" data-form-human></div>
    </div>
</dialog>
