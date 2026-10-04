// Core's browser door (engine/http/forms.ts), as the widget calls it: every request carries the
// site's public key and nothing else; the tenant token and the CRM login never reach the page.

export type Area = { id: string; name: string; county_municipality_code: string | null };

export type Config = {
  site: string;
  kinds: string[];
  areas: Area[];
  human: { provider: string; site_key: string } | null;
};

export type RecordInfo = {
  title: string | null;
  rooms: number | null;
  living_space: number | null;
  areas: Area[];
  county_municipality_code: string | null;
  viewings: { id: string | null; starts_at: string | null; ends_at: string | null }[];
};

export type Slot = {
  id: string;
  starts_at: string | null;
  ends_at: string | null;
  available: boolean | null;
  free_spots: number | null;
};

export type Viewing = {
  id: string;
  starts_at: string | null;
  ends_at: string | null;
  deadline_at: string | null;
  slots: Slot[];
};

export type Answer = {
  status: number;
  body: {
    id?: string;
    status?: string;
    reference?: string | null;
    reason?: string;
    error?: string;
  };
};

export const CLIENT = 'core-forms/1.0';

export class Api {
  private configOnce: Promise<Config> | null = null;

  constructor(
    private readonly core: string,
    private readonly siteKey: string,
  ) {}

  /** What this site may send, asked once per page. */
  config(): Promise<Config> {
    this.configOnce ??= this.get<Config>('/v1/forms/config').catch((error: unknown) => {
      this.configOnce = null;
      throw error;
    });
    return this.configOnce;
  }

  record(connectionId: string, remoteId: string): Promise<RecordInfo> {
    return this.get<RecordInfo>('/v1/forms/record', {
      connection_id: connectionId,
      remote_id: remoteId,
    });
  }

  slots(connectionId: string, remoteId: string): Promise<{ viewings: Viewing[] }> {
    return this.get<{ viewings: Viewing[] }>('/v1/forms/slots', {
      connection_id: connectionId,
      remote_id: remoteId,
    });
  }

  /** The submission, with the bot gate's token when the site has a gate. The status is the answer. */
  async submit(submission: Record<string, unknown>, human: string | null): Promise<Answer> {
    const headers = this.headers();
    headers['content-type'] = 'application/json';
    if (human) headers['x-core-human'] = human;
    const response = await fetch(`${this.core}/v1/forms/submissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submission),
    });
    let body: Answer['body'] = {};
    try {
      body = (await response.json()) as Answer['body'];
    } catch {
      // an answer with no body is still an answer
    }
    return { status: response.status, body };
  }

  private headers(): Record<string, string> {
    return { 'x-core-site-key': this.siteKey, 'x-core-client': CLIENT };
  }

  private async get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(this.core + path);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await fetch(url.toString(), { headers: this.headers() });
    if (!response.ok) throw new Error(`${path}: HTTP ${String(response.status)}`);
    return (await response.json()) as T;
  }
}
