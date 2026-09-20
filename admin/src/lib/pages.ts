// The eight destinations of the information architecture (docs/admin-panel-design.md §2), in one
// list, so the navigation and the command palette can never disagree.
export type Page = { to: string; label: string; icon: string; what: string };

export const PAGES: Page[] = [
  { to: '/', label: 'Overview', icon: 'gauge', what: 'The verdict, the day, the sites' },
  { to: '/flow', label: 'Flow', icon: 'activity', what: 'What is in flight, live' },
  {
    to: '/records',
    label: 'Records',
    icon: 'search',
    what: 'Find a record and see everything about it',
  },
  {
    to: '/tenants',
    label: 'Tenants',
    icon: 'building',
    what: 'Customers, their CRMs and their sites',
  },
  { to: '/runs', label: 'Runs', icon: 'play', what: 'Recompute or fetch again, by scope' },
  { to: '/events', label: 'Events', icon: 'list', what: 'Everything that happened' },
  { to: '/crms', label: 'CRMs', icon: 'plug', what: 'Each adapter’s own page' },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'settings',
    what: 'Configuration, versions, maintenance',
  },
];
