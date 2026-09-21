// The CRMs pages (§3 H): one per adapter that registered, drawn entirely from what the adapter
// reports as data. The engine hands the descriptions on and runs the actions the adapter declared;
// it never inspects what any of it means, and no CRM is named anywhere in here.
import { adminFor, adminProviders, manifestFor } from '../registry.js';
import { connectionById, connectionsForProvider } from '../storage/connections.js';
import type { AdminDirections, AdminField, AdminSection, Datatype } from '../adapter-api/types.js';

export type CrmSummary = {
  provider: string;
  datatypes: Datatype[];
  connections: number;
  /** The login fields a tenant's connection asks for, so the tenant page can draw the form. */
  credentials: AdminField[];
};

/** Every adapter that brought a panel. A second CRM appears here by itself. */
function listCrms(): CrmSummary[] {
  return adminProviders().map((provider) => ({
    provider,
    datatypes: manifestFor(provider)?.datatypes ?? [],
    connections: 0,
    credentials: adminFor(provider)?.credentials ?? [],
  }));
}

/** The list with the connection counts filled in. */
export async function crms(): Promise<CrmSummary[]> {
  return Promise.all(
    listCrms().map(async (crm) => ({
      ...crm,
      connections: (await connectionsForProvider(crm.provider)).length,
    })),
  );
}

export type CrmPage = {
  provider: string;
  datatypes: Datatype[];
  directions: AdminDirections;
  sections: AdminSection[];
  credentials: AdminField[];
};

export async function crmPage(provider: string): Promise<CrmPage | null> {
  const admin = adminFor(provider);
  if (!admin) return null;
  const connections = await connectionsForProvider(provider);
  return {
    provider,
    datatypes: manifestFor(provider)?.datatypes ?? [],
    directions: admin.directions(),
    sections: await admin.panel(connections),
    credentials: admin.credentials,
  };
}

/** Run an action a section declared. The adapter's message goes to whoever pressed the button. */
export async function act(
  provider: string,
  action: string,
  params: Record<string, string>,
): Promise<{ message: string } | { error: string }> {
  const admin = adminFor(provider);
  if (!admin) return { error: `No ${provider} adapter is registered.` };
  try {
    return await admin.act(action, params, await connectionsForProvider(provider));
  } catch (error) {
    return { error: String(error) };
  }
}

export type ProbeInput = {
  /** What a person typed on the page. Empty on a saved connection nobody has re-typed. */
  typed: Record<string, string>;
  officeIds: string[];
  /** A saved connection, whose stored login is tried when nothing was typed. */
  connectionId?: string;
};

/**
 * Try a login (§3 A, Should). What a person typed becomes the adapter's own document, exactly as a
 * save would store it, so a yes here means a yes afterwards. On a saved connection the page has no
 * password to send — a stored secret never reaches the browser — so nothing typed means "try the
 * login Core already holds", which is what a person pressing the button on a saved connection is
 * asking (Patric, 2026-09-21: the check did not work there).
 */
export async function probe(
  provider: string,
  input: ProbeInput,
): Promise<{ ok: boolean; detail: string }> {
  const admin = adminFor(provider);
  if (!admin?.probe) {
    return { ok: false, detail: `The ${provider} adapter cannot try a login.` };
  }
  const typed = Object.entries(input.typed).filter(([, value]) => value !== '');
  let credentials = typed.length > 0 ? JSON.stringify(Object.fromEntries(typed)) : null;
  let officeIds = input.officeIds;

  if (credentials === null) {
    if (!input.connectionId) {
      return { ok: false, detail: 'Type the login first, or save the connection and try again.' };
    }
    const stored = await connectionById(input.connectionId);
    if (!stored?.credentials) {
      return { ok: false, detail: 'This connection holds no login yet. Type one and try again.' };
    }
    credentials = stored.credentials;
    // The offices the page shows may be edited but not yet saved; those are the ones to try.
    if (officeIds.length === 0) officeIds = stored.licensedOffices;
  }

  try {
    return await admin.probe(credentials, officeIds);
  } catch (error) {
    return { ok: false, detail: String(error) };
  }
}
