// What a tenant's page and the pages under it share (the tenant mockups, images 02 to 10): reading
// the tenant, which updates by itself, and the frame of a page under it, with the link back.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api, Refused, type Brokerage, type Crm } from './api';
import { useShell } from './Shell';
import { failureWords, GONE } from './failure';
import { ChevronLeftIcon } from './icons';

const SLOW_MS = 15_000;
const FAST_MS = 4_000;

type Load = 'loading' | 'missing' | 'failed' | 'ok';

/** The tenant, read again every few seconds, faster while the page waits for something. */
export function useTenant(id: number, fast = false) {
  const { away } = useShell();
  const [page, setPage] = useState<Brokerage | null>(null);
  const [state, setState] = useState<Load>('loading');
  const [failure, setFailure] = useState('');
  /** The reads asked for, and the latest whose page is shown: an older answer comes too late. */
  const asked = useRef(0);
  const shown = useRef(0);
  /** Read the page again: null once it shows this read or a later one, else what went wrong. */
  const load = useCallback(async (): Promise<string | null> => {
    asked.current += 1;
    const read = asked.current;
    try {
      const next = await api.brokerage(id);
      if (read < shown.current) return null;
      shown.current = read;
      setPage(next);
      setState('ok');
      return null;
    } catch (error) {
      if (read < shown.current) return null;
      if (away(error)) return null;
      if (error instanceof Refused && error.status === 404) {
        setState('missing');
        return GONE;
      }
      const words = failureWords(error);
      setFailure(words);
      setState((was) => (was === 'ok' ? 'ok' : 'failed'));
      return words;
    }
  }, [id, away]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), fast ? FAST_MS : SLOW_MS);
    return () => clearInterval(timer);
  }, [load, fast]);
  return { page, state, failure, load };
}

export type TenantRead = ReturnType<typeof useTenant>;

/** The CRM a connection is with, as Core reads it; its name alone when Core no longer has its code. */
export const crmFor = (page: Brokerage, provider: string): Crm =>
  page.crms.find((crm) => crm.provider === provider) ?? { provider, name: provider, fields: [] };

/** A number from the address, or null. */
export const idOf = (value: string | undefined): number | null =>
  value && /^\d+$/.test(value) ? Number(value) : null;

/** A page this address does not name. */
export function Nothing({ words = 'There is no tenant at this address.' }: { words?: string }) {
  return (
    <main className="k-page">
      <Link className="k-back" to="/brokerages">
        <ChevronLeftIcon size={16} />
        Tenants
      </Link>
      <p className="k-quiet">{words}</p>
    </main>
  );
}

/**
 * A page under a tenant (images 04 to 10): the link back, the title, and the page, once the
 * tenant is read. `back` leads elsewhere than the tenant's page, as from the Inbox.
 */
export function UnderTenant({
  read,
  title,
  back,
  children,
}: {
  read: TenantRead;
  title: (page: Brokerage) => string;
  back?: { to: string; words: string };
  children: (page: Brokerage) => ReactNode;
}) {
  const { page, state, failure } = read;
  if (state === 'missing') return <Nothing />;
  if (state === 'failed') {
    return (
      <main className="k-page">
        <p className="k-quiet">{failure} The page tries again by itself.</p>
      </main>
    );
  }
  if (!page) return null;
  return (
    <main className="k-page">
      <Link className="k-back" to={back?.to ?? `/brokerages/${String(page.id)}`}>
        <ChevronLeftIcon size={16} />
        {back?.words ?? page.name}
      </Link>
      <h1 className="k-page-title k-page-title-large k-page-title-under">{title(page)}</h1>
      {children(page)}
    </main>
  );
}
