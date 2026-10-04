# The forms widget

One script a site includes once (docs/forms.md, "The widget", decided with question 137), which
turns every button marked for it into Core's form wizard: the interest in a home, the booking of
a viewing slot, the free valuation (the seller's lead), and after each the optional search
profile (question 139). Built with Vite into `dist/widget/forms.js` and served by Core's web
process at `/widget/forms.js` (`engine/http/forms.ts`), so a fix reaches every site on its next
page view, within the file's five-minute cache.

```
src/main.ts     the script tag's data, the click binding (capture phase, shadow roots included)
src/wizard.ts   the wizard: the steps, the slots, the person, the profile, the answers
src/api.ts      Core's browser door: config, record, slots, submit, with the site key
src/texts.ts    every word the visitor reads, in Swedish
src/styles.css  the look, inlined into the shadow root; the site tunes the --core-forms-* variables
```

## On a site

```html
<script
  src="https://core.kowboy.se/widget/forms.js"
  data-site-key="pk_…"
  data-policy-url="https://acme.se/integritetspolicy"
  defer
></script>
```

The site key is on the site's row of the tenant's page in the admin area, public, beside the
bell secret; the addresses the key may be used from are typed there too (empty: the bell
address's site). The WordPress plugin prints the tag itself once the key is in its settings
(`clients/wordpress/core-client/includes/forms.php`); a Lovable site puts it in its layout.

The buttons, as the theme "Kowboy 2026" marks them:

```html
<a data-core-form="interest" data-record="property:<connection>:<id>" href="#k-agents"
  >Anmäl intresse</a
>
<a
  data-core-form="viewing"
  data-record="property:<connection>:<id>"
  data-viewing="<viewing id>"
  href="#k-agents"
  >Boka här</a
>
<a data-core-form="lead" data-office="<office id>" href="#k-contact">Boka fri värdering</a>
```

`data-viewing` is optional: with it the booking step shows that viewing's slots only, and a
viewing with one free slot has it picked. `data-office` is optional on a lead: without it Core
fills the tenant's only office. The `href` is where the button leads while the widget is not on
the page; the widget prevents the click's default, so a theme's own click handler that checks
`event.defaultPrevented` steps back.

## What it does, and what it never has

- Asks Core once per page what the site may send, with the site's area list for the profile
  step and the bot gate to render (`GET /v1/forms/config`); reads the home's street, rooms,
  living space, areas and municipality code for the heading and the prefill
  (`GET /v1/forms/record`); reads the slots live for a booking (`GET /v1/forms/slots`); posts
  each submission (`POST /v1/forms/submissions`). Every call carries `X-Core-Site-Key`.
- The main submission goes the moment its information is in (a booking after the slot and the
  person, an interest or a lead after the person); the profile step is a second submission,
  `search_profile`, and skipping it loses nothing. The home's `object_type` is sent as null:
  the record's `type` is the CRM's own enumeration, and reading it would put CRM knowledge in
  a client; both CRMs take null.
- Remembers the person in the visitor's own browser after a sent form (first-party storage,
  with a line saying so and a "Glöm mig"), so the next form is one tap.
- Against bots: Turnstile when the site's config names it (the token travels as
  `X-Core-Human`, verified by Core), a honeypot field, and at least three seconds from open to
  send; Core limits the rate per tenant and per address.
- Never holds the tenant token or the CRM login, and never decides anything from a record's
  values: what it shows, it copies.

`npm run build:widget` builds it alone; `npm run typecheck` checks it; the browser journey
`clients/wordpress/e2e/forms-widget.spec.ts` walks the three forms on the test site and the
acceptance test `acceptance/forms-widget.test.ts` proves the door.
