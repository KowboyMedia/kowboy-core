// The navigation and the command palette read the engine's own list of destinations, so the area,
// the adapters' setup directions and the acceptance test that checks them can never disagree
// (engine/admin/pages.ts). Only the icon is the app's own.
import { PAGES, type Page } from '../../../engine/admin/pages';

const ICON: Record<string, string> = {
  Overview: 'gauge',
  Flow: 'activity',
  Records: 'search',
  Tenants: 'building',
  'Manual sync': 'play',
  'Failed forms': 'inbox',
  Events: 'list',
  CRMs: 'plug',
  Settings: 'settings',
};

export type NavItem = Page & { icon: string };

export const NAV: NavItem[] = PAGES.map((page) => ({ ...page, icon: ICON[page.name] ?? 'gauge' }));
