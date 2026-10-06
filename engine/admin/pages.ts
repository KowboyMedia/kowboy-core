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
  {
    name: 'Manual sync',
    path: '/manual-sync',
    what: 'Fetch from the CRM, recompute or send to the sites, by scope',
  },
  {
    name: 'Failed forms',
    path: '/forms',
    what: 'Forms the CRM did not take, to read and send again',
  },
  { name: 'Events', path: '/events', what: 'Everything that happened' },
  { name: 'CRMs', path: '/crms', what: 'Each adapter’s own page' },
  { name: 'Settings', path: '/settings', what: 'Configuration, versions, maintenance' },
];

export const PAGE_NAMES: string[] = PAGES.map((page) => page.name);

/**
 * The pages a piece of setup text names. The convention every adapter's directions follow is
 * "On <Page>", written exactly as the navigation labels it — a page whose name is two words is
 * matched whole, so "On Manual sync" is one page and not a page called "Manual". What follows
 * "On " and is not a page comes back as it is, which is how the test catches it.
 */
export function pagesNamedIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\bOn ([A-Z][A-Za-z ]*)/g)) {
    const rest = match[1] ?? '';
    found.add(PAGE_NAMES.find((name) => rest.startsWith(name)) ?? rest.split(/[\s,.]/)[0] ?? '');
  }
  return [...found];
}
