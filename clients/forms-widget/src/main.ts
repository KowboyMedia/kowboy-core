// The forms widget (docs/forms.md, "The widget", question 137): one script a site includes once,
//
//   <script src="https://core.kowboy.se/widget/forms.js" data-site-key="pk_…" defer></script>
//
// From then on every button marked `data-core-form` (interest, viewing or lead, with
// `data-record="property:<connection>:<id>"` on the first two) opens the wizard, which talks to
// Core with the site's public key. The click is taken in the capture phase and prevented, so a
// theme's own fallback (a scroll to the agent's card while the widget is absent) steps back.
// Buttons inside a shadow root count too: the composed path of the click crosses it. No
// framework, Swedish texts built in, the look from CSS variables and the site's font.
import { Api } from './api.js';
import { Wizard, type Kind } from './wizard.js';

const KINDS: Kind[] = ['interest', 'viewing', 'lead'];

function start(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  const siteKey = script?.dataset['siteKey'] ?? '';
  const core = (
    script?.dataset['core'] ?? (script ? new URL(script.src, location.href).origin : '')
  ).replace(/\/$/, '');
  if (!siteKey || !core) {
    console.warn('Core forms: the script tag needs data-site-key, and a src on Core');
    return;
  }
  const api = new Api(core, siteKey);
  const wizard = new Wizard(api, { policyUrl: script?.dataset['policyUrl'] ?? '' });

  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented) return;
      const button = event
        .composedPath()
        .find(
          (node): node is Element => node instanceof Element && node.hasAttribute('data-core-form'),
        );
      if (!button) return;
      const kind = button.getAttribute('data-core-form');
      if (!KINDS.includes(kind as Kind)) return;
      event.preventDefault();
      void wizard.open(kind as Kind, {
        record: button.getAttribute('data-record'),
        office: button.getAttribute('data-office'),
        viewing: button.getAttribute('data-viewing'),
      });
    },
    true,
  );
}

start();
