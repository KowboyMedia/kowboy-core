// The wizard (docs/forms.md, "What the modal asks", question 139): up to three steps, the slot
// for a booking, the person, and the optional search profile under the confirmation. The main
// submission goes the moment its information is in; whatever happens after, the CRM has the
// person. One dialog in its own shadow root, built once, filled per form. Nothing here decides
// anything from a record's values: the heading, the prefill and the chips are copied from what
// Core answers.
import { Api, type Area, type Config, type RecordInfo, type Viewing } from './api.js';
import { TEXT } from './texts.js';
import css from './styles.css?inline';

export type Kind = 'interest' | 'viewing' | 'lead';
type Step = 'slot' | 'person' | 'profile' | 'end' | 'fail';
export type Target = { record: string | null; office: string | null; viewing: string | null };
type Person = { first_name: string; last_name: string; email: string; phone: string };
type RecordRef = { datatype: 'property'; connection_id: string; remote_id: string };

const STEPS: Record<Kind, Step[]> = {
  interest: ['person', 'profile'],
  viewing: ['slot', 'person', 'profile'],
  lead: ['person', 'profile'],
};
/** The whitelisted values of the profile step (docs/forms.md): nothing outside them is sent. */
const ROOM_STEPS = [1, 2, 3, 4, 5, 6, 7];
const AREA_STEPS = [
  20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130,
  135, 140, 150, 160, 170, 180, 200, 250,
];
/** The visitor's details after a sent form, in their own browser, so the next form is one tap. */
const REMEMBER = 'core-forms:person';
/** No submission leaves before this long after the wizard opened: one of Core's own bot measures. */
const MIN_OPEN_MS = 3_000;
const HUMAN_WAIT_MS = 8_000;
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const MARKUP = `
<dialog aria-labelledby="title">
  <div class="modal">
    <div class="top" id="top">
      <div>
        <h2 id="title"></h2>
        <p class="sub" id="subtitle"></p>
      </div>
      <button class="btn btn--text" type="button" id="close"></button>
    </div>
    <div class="progress" id="progress" aria-hidden="true"></div>
    <p class="sub" id="loading" hidden></p>

    <form class="step" id="step-slot" novalidate hidden>
      <div class="eyebrow" id="choose-time"></div>
      <div class="slots" id="slots" role="radiogroup"></div>
      <p class="sub" id="no-times" hidden></p>
      <p class="error" id="slot-error" hidden></p>
      <div class="row"><span></span><button class="btn" type="submit" id="next"></button></div>
    </form>

    <form class="step" id="step-person" novalidate hidden>
      <div class="eyebrow" id="your-details"></div>
      <div class="grid2">
        <label class="l"><span id="l-first"></span><input class="field" name="first_name" autocomplete="given-name" required></label>
        <label class="l"><span id="l-last"></span><input class="field" name="last_name" autocomplete="family-name" required></label>
        <label class="l"><span id="l-phone"></span><input class="field" name="phone" type="tel" autocomplete="tel" required></label>
        <label class="l"><span id="l-email"></span><input class="field" name="email" type="email" autocomplete="email" required></label>
      </div>
      <label class="l"><span id="l-message"></span><textarea class="field" name="message"></textarea></label>
      <label class="hp" aria-hidden="true">Webbplats<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="consent"><input type="checkbox" name="consent" required><span id="consent-text"></span></label>
      <p class="hint" id="remembered" hidden><span id="remembered-text"></span> <button class="btn btn--text" type="button" id="forget"></button></p>
      <p class="error" id="person-error" hidden></p>
      <div class="human"><slot name="human"></slot></div>
      <div class="row"><span></span><button class="btn" type="submit" id="send"></button></div>
    </form>

    <form class="step" id="step-profile" novalidate hidden>
      <div class="next">
        <div class="eyebrow" id="profile-step"></div>
        <h3 id="profile-heading"></h3>
        <p class="sub" id="profile-text"></p>
      </div>
      <div class="grid2">
        <label class="l"><span id="l-rooms"></span><select class="field" name="rooms_min"></select></label>
        <label class="l"><span id="l-area"></span><select class="field" name="living_area_min"></select></label>
      </div>
      <div class="l"><span id="l-areas"></span>
        <p class="hint" id="areas-hint"></p>
        <div class="chips" id="areas" role="group"></div>
      </div>
      <label class="consent" id="current-home"><input type="checkbox" name="current_home"><span id="current-home-text"></span></label>
      <div class="row">
        <button class="btn btn--text" type="button" id="skip"></button>
        <button class="btn" type="submit" id="send-profile"></button>
      </div>
    </form>

    <div class="step" id="step-end" hidden>
      <div class="big" id="end-title"></div>
      <p class="sub" id="end-text"></p>
      <div class="row"><span></span><button class="btn" type="button" id="finish"></button></div>
    </div>

    <div class="step" id="step-fail" hidden>
      <div class="big" id="fail-title"></div>
      <p class="sub" id="fail-text"></p>
      <div class="row">
        <button class="btn btn--text" type="button" id="back"></button>
        <button class="btn" type="button" id="retry"></button>
      </div>
    </div>
  </div>
</dialog>`;

const uuid = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

/** The closest whitelisted value lower than the home's (Patric, 2026-10-04: 78 kvm prefills 75), as the select's value; nothing without a home. */
function prefill(steps: number[], value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const below = steps.filter((step) => step < value).pop();
  return below === undefined ? '' : String(below);
}

const day = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Stockholm',
});
const clock = new Intl.DateTimeFormat('sv-SE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Stockholm',
});

/** "söndag 12 oktober · 13.00–13.30", from the slot's moments; what the CRM gave when one is missing. */
function slotLabel(startsAt: string | null, endsAt: string | null): string {
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return startsAt ?? '';
  const time = clock.format(start).replace(':', '.');
  const until =
    end && !Number.isNaN(end.getTime()) ? `–${clock.format(end).replace(':', '.')}` : '';
  return `${day.format(start)} · ${time}${until}`;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The page's address without its fragment, and its UTM tags, for `source`. */
function source(): { page: string; utm: Record<string, string> } {
  const url = new URL(location.href);
  const utm: Record<string, string> = {};
  for (const [key, value] of url.searchParams) if (key.startsWith('utm_')) utm[key] = value;
  url.hash = '';
  return { page: url.toString(), utm };
}

function remembered(): Person | null {
  try {
    const stored = localStorage.getItem(REMEMBER);
    return stored ? (JSON.parse(stored) as Person) : null;
  } catch {
    return null;
  }
}

function remember(person: Person | null): void {
  try {
    if (person) localStorage.setItem(REMEMBER, JSON.stringify(person));
    else localStorage.removeItem(REMEMBER);
  } catch {
    // a browser that refuses storage still gets the form
  }
}

let turnstileLoading: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  turnstileLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile did not load'));
    document.head.appendChild(script);
  });
  return turnstileLoading;
}

export class Wizard {
  private readonly root: ShadowRoot;
  private readonly dialog: HTMLDialogElement;
  /** Turnstile renders in the light DOM, slotted into the person step, where its script can see it. */
  private readonly humanHost: HTMLElement;
  private kind: Kind = 'interest';
  private target: Target = { record: null, office: null, viewing: null };
  private config: Config | null = null;
  private record: RecordInfo | null = null;
  private viewings: Viewing[] = [];
  private slotId: string | null = null;
  private stepIndex = 0;
  private openedAt = 0;
  private person: Person | null = null;
  private consentAt = '';
  private readonly chosenAreas = new Set<string>();
  private humanWidget: string | null = null;
  private humanToken: string | null = null;
  private sending = false;

  constructor(
    private readonly api: Api,
    private readonly options: { policyUrl: string },
  ) {
    const host = document.createElement('core-forms');
    this.root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    this.root.appendChild(style);
    const template = document.createElement('template');
    template.innerHTML = MARKUP;
    this.root.appendChild(template.content);
    this.humanHost = document.createElement('div');
    this.humanHost.slot = 'human';
    host.appendChild(this.humanHost);
    document.body.appendChild(host);
    this.dialog = this.root.querySelector('dialog') as HTMLDialogElement;
    this.words();
    this.bind();
  }

  private $<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.root.getElementById(id) as T;
  }

  private field(name: string): HTMLInputElement {
    return this.root.querySelector(`[name="${name}"]`) as HTMLInputElement;
  }

  /** The words that never change, put in once. */
  private words(): void {
    const set = (id: string, text: string): void => {
      this.$(id).textContent = text;
    };
    set('close', TEXT.close);
    set('choose-time', TEXT.chooseTime);
    set('no-times', TEXT.noTimes);
    set('slot-error', TEXT.slotMissing);
    set('next', TEXT.next);
    set('your-details', TEXT.yourDetails);
    set('l-first', TEXT.firstName);
    set('l-last', TEXT.lastName);
    set('l-phone', TEXT.phone);
    set('l-email', TEXT.email);
    set('l-message', TEXT.message);
    set('remembered-text', TEXT.remembered);
    set('forget', TEXT.forget);
    set('person-error', TEXT.personMissing);
    set('send', TEXT.send);
    set('profile-heading', TEXT.profileHeading);
    set('profile-text', TEXT.profileText);
    set('l-rooms', TEXT.roomsMin);
    set('l-area', TEXT.areaMin);
    set('l-areas', TEXT.areas);
    set('current-home-text', TEXT.currentHome);
    set('skip', TEXT.skip);
    set('send-profile', TEXT.send);
    set('finish', TEXT.done);
    set('back', TEXT.back);
    set('retry', TEXT.retry);
    set('loading', TEXT.loading);
    this.$('areas').setAttribute('aria-label', TEXT.areas);
    this.$('slots').setAttribute('aria-label', TEXT.chooseTime);
    const consent = this.$('consent-text');
    consent.textContent = TEXT.consent;
    if (this.options.policyUrl) {
      const link = document.createElement('a');
      link.href = this.options.policyUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = TEXT.policy;
      consent.appendChild(link);
    } else {
      consent.appendChild(document.createTextNode(TEXT.policy));
    }
    consent.appendChild(document.createTextNode(TEXT.consentEnd));
    this.fillSelect('rooms_min', ROOM_STEPS, TEXT.rooms);
    this.fillSelect('living_area_min', AREA_STEPS, TEXT.sqm);
  }

  private fillSelect(name: string, steps: number[], unit: string): void {
    const select = this.field(name);
    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = TEXT.noRequirement;
    select.appendChild(none);
    for (const step of steps) {
      const option = document.createElement('option');
      option.value = String(step);
      option.textContent = `${String(step)} ${unit}`;
      select.appendChild(option);
    }
  }

  private bind(): void {
    this.$('close').addEventListener('click', () => this.dialog.close());
    this.$('finish').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
    this.$('step-slot').addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.slotId) {
        this.$('slot-error').hidden = false;
        return;
      }
      this.stepIndex += 1;
      this.showStep();
    });
    this.$('step-person').addEventListener('submit', (event) => {
      event.preventDefault();
      void this.sendMain();
    });
    this.$('step-profile').addEventListener('submit', (event) => {
      event.preventDefault();
      void this.sendProfile();
    });
    this.$('skip').addEventListener('click', () => this.end(TEXT.profileSkipped));
    this.$('forget').addEventListener('click', () => {
      remember(null);
      for (const name of ['first_name', 'last_name', 'phone', 'email']) this.field(name).value = '';
      this.$('remembered').hidden = true;
    });
    this.$('back').addEventListener('click', () => {
      this.stepIndex = 0;
      this.slotId = null;
      this.renderSlots();
      this.showStep();
    });
    this.$('retry').addEventListener('click', () => this.showStep('person'));
  }

  /** A button was pressed: the dialog opens at once and fills as Core answers. */
  async open(kind: Kind, target: Target): Promise<void> {
    this.kind = kind;
    this.target = target;
    this.record = null;
    this.viewings = [];
    this.slotId = null;
    this.stepIndex = 0;
    this.person = null;
    this.chosenAreas.clear();
    this.openedAt = Date.now();
    this.$('top').classList.remove('is-done');
    this.$('title').textContent = TEXT.title[kind];
    this.$('subtitle').textContent = kind === 'lead' ? TEXT.subtitleLead : '';
    this.$('loading').hidden = false;
    for (const step of ['slot', 'person', 'profile', 'end', 'fail'])
      this.$(`step-${step}`).hidden = true;
    this.$('progress').innerHTML = '';
    if (!this.dialog.open) this.dialog.showModal();
    try {
      await this.load();
    } catch {
      this.$('loading').hidden = true;
      this.fail(TEXT.failed, TEXT.cannotLoad, false);
      return;
    }
    this.$('loading').hidden = true;
    this.resetPerson();
    this.renderSlots();
    this.renderProfile();
    this.showStep();
  }

  private recordRef(): RecordRef | null {
    const parts = this.target.record?.split(':') ?? [];
    if (parts.length < 3 || parts[0] !== 'property') return null;
    return {
      datatype: 'property',
      connection_id: parts[1] ?? '',
      remote_id: parts.slice(2).join(':'),
    };
  }

  private async load(): Promise<void> {
    const ref = this.kind === 'lead' ? null : this.recordRef();
    const [config, record, slots] = await Promise.all([
      this.api.config(),
      ref ? this.api.record(ref.connection_id, ref.remote_id) : Promise.resolve(null),
      ref && this.kind === 'viewing'
        ? this.api.slots(ref.connection_id, ref.remote_id)
        : Promise.resolve(null),
    ]);
    this.config = config;
    this.record = record;
    if (record?.title && this.kind !== 'lead') this.$('subtitle').textContent = record.title;
    const all = slots?.viewings ?? [];
    const named = this.target.viewing
      ? all.filter((viewing) => viewing.id === this.target.viewing)
      : [];
    this.viewings = named.length > 0 ? named : all;
  }

  private resetPerson(): void {
    const kept = remembered();
    for (const name of ['first_name', 'last_name', 'phone', 'email'] as const) {
      this.field(name).value = kept?.[name] ?? '';
    }
    this.field('message').value = '';
    this.field('website').value = '';
    this.field('consent').checked = false;
    this.$('remembered').hidden = kept === null;
    this.$('person-error').hidden = true;
    this.$('send').removeAttribute('disabled');
    this.$('send').textContent = TEXT.send;
  }

  private renderSlots(): void {
    const box = this.$('slots');
    box.innerHTML = '';
    const open: HTMLButtonElement[] = [];
    for (const viewing of this.viewings) {
      for (const slot of viewing.slots) {
        const button = document.createElement('button');
        button.className = 'slot';
        button.type = 'button';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.dataset['slot'] = slot.id;
        const when = document.createElement('span');
        when.textContent = slotLabel(slot.starts_at, slot.ends_at);
        const spots = document.createElement('small');
        const available = slot.available !== false;
        spots.textContent = available
          ? slot.free_spots === null
            ? ''
            : TEXT.placesLeft(slot.free_spots)
          : TEXT.full;
        button.append(when, spots);
        if (!available) button.disabled = true;
        else open.push(button);
        button.addEventListener('click', () => this.pickSlot(button));
        box.appendChild(button);
      }
    }
    this.$('no-times').hidden = box.children.length > 0;
    this.$('next').toggleAttribute('disabled', open.length === 0);
    this.$('slot-error').hidden = true;
    // A viewing's own button, with one free slot: picked (docs/forms.md, the clients' part).
    if (this.target.viewing && open.length === 1 && open[0]) this.pickSlot(open[0]);
  }

  private pickSlot(button: HTMLButtonElement): void {
    this.slotId = button.dataset['slot'] ?? null;
    for (const other of this.root.querySelectorAll('.slot')) {
      other.setAttribute('aria-checked', String(other === button));
    }
    this.$('slot-error').hidden = true;
  }

  private renderProfile(): void {
    const home = this.kind === 'lead' ? null : this.record;
    const steps = STEPS[this.kind];
    this.$('profile-step').textContent = TEXT.stepOf(steps.indexOf('profile') + 1, steps.length);
    this.select('rooms_min').value = prefill(ROOM_STEPS, home?.rooms);
    this.select('living_area_min').value = prefill(AREA_STEPS, home?.living_space);
    this.field('current_home').checked = false;
    this.$('current-home').hidden = home === null;
    this.$('areas-hint').textContent = home ? TEXT.areasHintHome : TEXT.areasHintLead;
    this.chosenAreas.clear();
    for (const own of home?.areas ?? []) this.chosenAreas.add(own.id);
    this.renderAreaChips();
  }

  private select(name: string): HTMLSelectElement {
    return this.root.querySelector(`select[name="${name}"]`) as HTMLSelectElement;
  }

  /** The site's areas as chips, the home's pressed; a tap presses or releases one. */
  private renderAreaChips(): void {
    const chips = this.$('areas');
    chips.innerHTML = '';
    for (const area of this.config?.areas ?? []) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.textContent = area.name;
      chip.setAttribute('aria-pressed', String(this.chosenAreas.has(area.id)));
      chip.addEventListener('click', () => {
        if (this.chosenAreas.has(area.id)) this.chosenAreas.delete(area.id);
        else this.chosenAreas.add(area.id);
        chip.setAttribute('aria-pressed', String(this.chosenAreas.has(area.id)));
      });
      chips.appendChild(chip);
    }
  }

  private showStep(name?: Step): void {
    const steps = STEPS[this.kind];
    const current: Step = name ?? steps[this.stepIndex] ?? 'end';
    for (const step of ['slot', 'person', 'profile', 'end', 'fail'] as const) {
      this.$(`step-${step}`).hidden = step !== current;
    }
    const at = steps.indexOf(current);
    this.$('progress').innerHTML = steps
      .map((_, index) => `<i class="${index <= (at < 0 ? steps.length - 1 : at) ? 'on' : ''}"></i>`)
      .join('');
    if (current === 'person') void this.renderHuman();
    const first = this.$(`step-${current}`).querySelector<HTMLElement>(
      'input:not([tabindex="-1"]), button.slot:not([disabled]), select, textarea, button',
    );
    first?.focus();
  }

  /** The bot gate's challenge, rendered while the visitor types; its token travels with the send. */
  private async renderHuman(): Promise<void> {
    const human = this.config?.human;
    if (!human || human.provider !== 'turnstile') return;
    try {
      await loadTurnstile();
    } catch {
      return;
    }
    if (!window.turnstile) return;
    if (this.humanWidget) {
      window.turnstile.reset(this.humanWidget);
      this.humanToken = null;
      return;
    }
    this.humanWidget = window.turnstile.render(this.humanHost, {
      sitekey: human.site_key,
      appearance: 'interaction-only',
      size: 'flexible',
      callback: (token) => {
        this.humanToken = token;
      },
      'expired-callback': () => {
        this.humanToken = null;
      },
      'error-callback': () => {
        this.humanToken = null;
      },
    });
  }

  /** The token, waiting for the challenge a little; null when the site has no gate. */
  private async humanProof(): Promise<string | null | false> {
    if (!this.config?.human) return null;
    const until = Date.now() + HUMAN_WAIT_MS;
    while (!this.humanToken && Date.now() < until) await wait(200);
    return this.humanToken ?? false;
  }

  private readPerson(): Person | null {
    const value = (name: string): string => this.field(name).value.trim();
    const person = {
      first_name: value('first_name'),
      last_name: value('last_name'),
      email: value('email'),
      phone: value('phone'),
    };
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(person.email);
    const complete = person.first_name && person.last_name && person.phone && emailOk;
    return complete && this.field('consent').checked ? person : null;
  }

  private base(kind: string): Record<string, unknown> {
    const submission: Record<string, unknown> = { id: uuid(), kind };
    const ref = this.kind === 'lead' ? null : this.recordRef();
    if (ref) submission['record'] = ref;
    else if (this.target.office) submission['office_id'] = this.target.office;
    if (kind === 'viewing') submission['slot_id'] = this.slotId;
    submission['person'] = this.person;
    const message = this.field('message').value.trim();
    if (message && kind !== 'search_profile') submission['message'] = message;
    submission['consent'] = { given: true, at: this.consentAt };
    submission['source'] = source();
    return submission;
  }

  private async sendMain(): Promise<void> {
    if (this.sending) return;
    const person = this.readPerson();
    if (!person) {
      this.$('person-error').hidden = false;
      return;
    }
    this.$('person-error').hidden = true;
    this.person = person;
    this.consentAt = new Date().toISOString();
    this.sending = true;
    this.$('send').setAttribute('disabled', '');
    this.$('send').textContent = TEXT.sending;
    try {
      // The honeypot filled: a bot, which is told it succeeded and sends nothing.
      if (this.field('website').value !== '') return this.confirmed();
      await wait(Math.max(0, MIN_OPEN_MS - (Date.now() - this.openedAt)));
      const proof = await this.humanProof();
      if (proof === false) {
        this.$('person-error').textContent = TEXT.humanWaiting;
        this.$('person-error').hidden = false;
        return;
      }
      const answer = await this.api.submit(this.base(this.kind), proof);
      if (answer.status === 200) {
        remember(person);
        return this.confirmed();
      }
      this.answerFailed(answer.status, answer.body.reason ?? null);
    } catch {
      this.fail(TEXT.failed, TEXT.failedText, false);
    } finally {
      this.sending = false;
      this.$('send').removeAttribute('disabled');
      this.$('send').textContent = TEXT.send;
      this.$('person-error').textContent = TEXT.personMissing;
      if (this.humanWidget && window.turnstile) {
        window.turnstile.reset(this.humanWidget);
        this.humanToken = null;
      }
    }
  }

  /** The confirmation becomes the heading, and the profile step follows (Patric, 2026-10-04). */
  private confirmed(): void {
    const home = this.record?.title ?? '';
    const slot = this.viewings
      .flatMap((viewing) => viewing.slots)
      .find((candidate) => candidate.id === this.slotId);
    const [title, text] =
      this.kind === 'viewing'
        ? TEXT.confirmed.viewing(home, slot ? slotLabel(slot.starts_at, slot.ends_at) : '')
        : this.kind === 'interest'
          ? TEXT.confirmed.interest(home)
          : TEXT.confirmed.lead();
    this.$('title').textContent = title;
    this.$('subtitle').textContent = text;
    this.$('top').classList.add('is-done');
    this.stepIndex += 1;
    this.showStep();
  }

  private answerFailed(status: number, reason: string | null): void {
    if (status === 409) {
      this.fail(TEXT.refused, reason || TEXT.refusedSlot, this.kind === 'viewing');
    } else if (status === 429) {
      this.fail(TEXT.failed, TEXT.tooMany, false);
    } else if (status === 403) {
      this.fail(TEXT.failed, TEXT.notHuman, false);
    } else {
      this.fail(TEXT.failed, TEXT.failedText, false);
    }
  }

  private fail(title: string, text: string, canGoBack: boolean): void {
    this.$('fail-title').textContent = title;
    this.$('fail-text').textContent = text;
    this.$('back').hidden = !canGoBack;
    this.showStep('fail');
  }

  private async sendProfile(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    this.$('send-profile').setAttribute('disabled', '');
    try {
      const value = (name: string): number | null => {
        const typed = this.select(name).value;
        return typed ? Number(typed) : null;
      };
      const chosen: Area[] = (this.config?.areas ?? []).filter((area_) =>
        this.chosenAreas.has(area_.id),
      );
      const submission = this.base('search_profile');
      submission['criteria'] = {
        // The home's type is the CRM's own enumeration, which a client never reads (README).
        object_type: null,
        rooms_min: value('rooms_min'),
        living_area_min: value('living_area_min'),
        areas: chosen,
        county_municipality_code:
          this.kind === 'lead' ? null : (this.record?.county_municipality_code ?? null),
      };
      if (this.kind !== 'lead')
        submission['contact_about_current_home'] = this.field('current_home').checked;
      const proof = await this.humanProof();
      const answer = await this.api.submit(submission, proof === false ? null : proof);
      if (answer.status === 200) this.end(TEXT.profileSent);
      else this.answerFailed(answer.status, answer.body.reason ?? null);
    } catch {
      this.fail(TEXT.failed, TEXT.failedText, false);
    } finally {
      this.sending = false;
      this.$('send-profile').removeAttribute('disabled');
    }
  }

  private end([title, text]: readonly [string, string]): void {
    this.$('end-title').textContent = title;
    this.$('end-text').textContent = text;
    this.showStep('end');
  }
}
