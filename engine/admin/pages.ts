// The admin area's destinations, in one place (docs/admin-panel-design.md §2). The navigation, the
// command palette and the adapters' setup directions all read this list, so none of them can name a
// page that does not exist: an adapter writes "On Records" and the acceptance test checks it against
// the list here (AGENTS.md, definition of done 5).
export type Page = {
  /** Exactly as the navigation labels it, and as a direction must write it. */
  name: string;
  path: string;
  what: string;
};

export const PAGES: Page[] = [
  { name: 'Overview', path: '/', what: 'The verdict, the day, the sites' },
  { name: 'Flow', path: '/flow', what: 'What is in flight, live' },
  {
    name: 'Records',
    path: '/records',
    what: 'Find a record and see everything about it',
  },
  { name: 'Tenants', path: '/tenants', what: 'Customers, their CRMs and their sites' },
  { name: 'Runs', path: '/runs', what: 'Recompute or fetch again, by scope' },
  { name: 'Events', path: '/events', what: 'Everything that happened' },
  { name: 'CRMs', path: '/crms', what: 'Each adapter’s own page' },
  { name: 'Settings', path: '/settings', what: 'Configuration, versions, maintenance' },
];

export const PAGE_NAMES: string[] = PAGES.map((page) => page.name);

/**
 * The pages a piece of setup text names. The convention every adapter's directions follow is
 * "On <Page>", written exactly as the navigation labels it; this is what the test reads.
 */
export const pagesNamedIn = (text: string): string[] => [
  ...new Set([...text.matchAll(/\bOn ([A-Z][A-Za-z]+)\b/g)].map((match) => match[1] ?? '')),
];
