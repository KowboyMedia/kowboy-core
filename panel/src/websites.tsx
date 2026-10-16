// A website's pieces that the new-brokerage steps and the brokerage page share (design B, images
// 08, 09, 11, 24, 28 and 29): its platform's words, the fields that add one, and the settings a
// person copies into it.
import type { Website } from './api';
import { ValueField } from './ui';

export type Platform = 'wordpress' | 'lovable';

export const PLATFORMS: Platform[] = ['wordpress', 'lovable'];

const WORDS: Record<
  Platform,
  {
    label: string;
    /** What fetches, as the website row names it: "WordPress plugin 2.4.1". */
    client: string;
    /** Where a person edits the website's settings. */
    editIn: string;
    /** Where the settings go. */
    settings: string;
    /** Where the tenant token goes. */
    token: string;
    /** Where the bell secret goes. */
    bell: string;
  }
> = {
  wordpress: {
    label: 'WordPress',
    client: 'WordPress plugin',
    editIn: 'WordPress',
    settings: 'WordPress → Kowboy Estates → Settings',
    token: 'WordPress → Kowboy Estates → Settings → Tenant token',
    bell: 'WordPress → Kowboy Estates → Settings → Bell secret',
  },
  lovable: {
    label: 'Lovable',
    client: 'Lovable kit',
    editIn: 'Supabase',
    settings: 'Supabase → Edge Functions → Secrets',
    token: 'Supabase → Edge Functions → Secrets → CORE_TENANT_TOKEN',
    bell: 'Supabase → Edge Functions → Secrets → CORE_BELL_SECRET',
  },
};

export const platformWords = (platform: Platform) => WORDS[platform];

export const isPlatform = (value: string | null | undefined): value is Platform =>
  value === 'wordpress' || value === 'lovable';

/** The platform a website named on its last fetch, if it is one the panel knows. */
export function platformOf(website: Website): Platform | null {
  const platform = website.client?.platform;
  return isPlatform(platform) ? platform : null;
}

/** "WordPress plugin 2.4.1", "Lovable kit 1.3.0", or that it has not fetched yet. */
export function clientLine(website: Website): string {
  const client = website.client;
  if (!client) return 'Hasn’t fetched its data yet';
  const name = isPlatform(client.platform) ? WORDS[client.platform].client : client.platform;
  return [name, client.version].filter(Boolean).join(' ');
}

/** The bell address a platform's website answers on, from its address; Lovable's is Supabase's. */
function bellFor(address: string, platform: Platform): string {
  if (platform !== 'wordpress') return '';
  try {
    const url = new URL(address);
    return `${url.origin}/wp-json/core/v1/bell`;
  } catch {
    return '';
  }
}

/** The address's host, as Core's lists name the website. */
function labelFor(address: string): string {
  try {
    return new URL(address).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export type WebsiteDraft = {
  platform: Platform;
  address: string;
  bellUrl: string;
  label: string;
  /** The person typed in the field, so the address no longer fills it in. */
  bellTyped: boolean;
  labelTyped: boolean;
};

export const newWebsite = (): WebsiteDraft => ({
  platform: 'wordpress',
  address: 'https://',
  bellUrl: '',
  label: '',
  bellTyped: false,
  labelTyped: false,
});

/** The address, the bell address and the label are all there. */
export const websiteReady = (draft: WebsiteDraft): boolean =>
  labelFor(draft.address) !== '' && draft.bellUrl.trim() !== '' && draft.label.trim() !== '';

function filled(draft: WebsiteDraft): WebsiteDraft {
  return {
    ...draft,
    bellUrl: draft.bellTyped ? draft.bellUrl : bellFor(draft.address, draft.platform),
    label: draft.labelTyped ? draft.label : labelFor(draft.address),
  };
}

/** Platform, address, bell address and label (image 08). */
export function WebsiteFields({
  draft,
  onChange,
}: {
  draft: WebsiteDraft;
  onChange: (draft: WebsiteDraft) => void;
}) {
  const set = (change: Partial<WebsiteDraft>) => onChange(filled({ ...draft, ...change }));
  return (
    <>
      <div className="k-field">
        <span className="k-label" id="website-platform">
          Platform
        </span>
        <div className="k-choice" role="radiogroup" aria-labelledby="website-platform">
          {PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              role="radio"
              aria-checked={draft.platform === platform}
              className={`k-choice-option${draft.platform === platform ? ' k-choice-on' : ''}`}
              onClick={() => set({ platform })}
            >
              {WORDS[platform].label}
            </button>
          ))}
        </div>
      </div>
      <div className="k-field">
        <label className="k-label" htmlFor="website-address">
          Website address <span className="k-required">*</span>
        </label>
        <input
          id="website-address"
          className="k-input"
          type="url"
          inputMode="url"
          spellCheck={false}
          value={draft.address}
          onChange={(event) => set({ address: event.target.value })}
        />
      </div>
      <div className="k-field">
        <div className="k-pair k-pair-wide">
          <div>
            <label className="k-label" htmlFor="website-bell">
              Bell address
            </label>
            <input
              id="website-bell"
              className="k-input k-input-code"
              type="url"
              spellCheck={false}
              placeholder={
                draft.platform === 'lovable'
                  ? 'https://<project>.supabase.co/functions/v1/core-sync'
                  : undefined
              }
              value={draft.bellUrl}
              onChange={(event) => set({ bellUrl: event.target.value, bellTyped: true })}
            />
            <p className="k-help">
              {draft.platform === 'lovable'
                ? 'The core-sync function of the website’s Supabase project.'
                : 'Filled in from the address.'}
            </p>
          </div>
          <div>
            <label className="k-label" htmlFor="website-label">
              Label
            </label>
            <input
              id="website-label"
              className="k-input"
              spellCheck={false}
              value={draft.label}
              onChange={(event) => set({ label: event.target.value, labelTyped: true })}
            />
            <p className="k-help">Shown in Core’s lists.</p>
          </div>
        </div>
      </div>
      <p className="k-help k-help-alone">
        Core makes the website’s bell secret. Next you copy it, with the other settings, into the
        website.
      </p>
    </>
  );
}

/** The settings a website needs, to copy into it (image 09): Core's address, the token, the bell secret. */
export function SettingsToPaste({
  coreUrl,
  token,
  bellSecret,
  platform,
}: {
  coreUrl: string;
  token: string | null;
  bellSecret: string;
  platform: Platform | null;
}) {
  const where = platform ? WORDS[platform].settings : null;
  return (
    <>
      <p className="k-step-text">
        {platform === 'lovable'
          ? `Enter these in ${where ?? ''} as CORE_URL, CORE_TENANT_TOKEN and CORE_BELL_SECRET. Copy gives the whole value. This page updates by itself.`
          : `Enter these in ${where ?? 'the website’s settings'} and save. Copy gives the whole value. This page updates by itself.`}
      </p>
      <div className="k-paste">
        <span className="k-label">Core URL</span>
        <ValueField value={coreUrl} />
      </div>
      <div className="k-paste">
        <span className="k-label">Tenant token</span>
        {token ? (
          <ValueField value={token} secret />
        ) : (
          <p className="k-help">
            Core keeps no copy of this brokerage’s token. Replace it on the brokerage’s page to get
            one you can copy.
          </p>
        )}
        <p className="k-help">
          The secret key all of this brokerage’s websites use to fetch data and send forms.
        </p>
      </div>
      <div className="k-paste">
        <span className="k-label">Bell secret</span>
        <ValueField value={bellSecret} secret />
        <p className="k-help">
          This website’s own secret: it checks that change notices come from Core.
        </p>
      </div>
    </>
  );
}
