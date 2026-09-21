// ⌘K: jump to a page, a tenant or a record id (§3 I, Should). One place to go anywhere, so
// nothing in the app is more than two keystrokes away.
import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router';
import { useList } from '@refinedev/core';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NAV } from '@/lib/pages';

type TenantSummary = { id: number; displayName: string };

/** The top bar's button and the keyboard both open the same thing, through this. */
const OPEN_PALETTE = 'core:open-palette';

export const openPalette = (): void => {
  window.dispatchEvent(new Event(OPEN_PALETTE));
};

/** How this computer writes the shortcut, so nobody has to know what ⌘ is. */
export const shortcut = (): string =>
  /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K';

export function Palette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { result } = useList<TenantSummary>({
    resource: 'tenants',
    queryOptions: { enabled: open },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((was) => !was);
      }
    };
    const onAsked = (): void => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE, onAsked);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE, onAsked);
    };
  }, []);

  const go = (to: string): void => {
    setOpen(false);
    setQuery('');
    void navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0">
        <DialogTitle className="sr-only">Go to</DialogTitle>
        <Command label="Go to" shouldFilter>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Go to a page, a tenant, or paste a record id…"
            className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nothing by that name. A record id searches the records.
            </Command.Empty>
            <Command.Group heading="Pages" className="px-1 text-xs text-muted-foreground">
              {NAV.map((item) => (
                <Command.Item
                  key={item.path}
                  value={`page ${item.name}`}
                  onSelect={() => go(item.path)}
                  className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
                >
                  {item.name}
                </Command.Item>
              ))}
            </Command.Group>
            {(result?.data ?? []).length > 0 && (
              <Command.Group heading="Tenants" className="px-1 pt-2 text-xs text-muted-foreground">
                {(result?.data ?? []).map((tenant) => (
                  <Command.Item
                    key={tenant.id}
                    value={`tenant ${tenant.displayName}`}
                    onSelect={() => go(`/tenants/${String(tenant.id)}`)}
                    className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
                  >
                    {tenant.displayName}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {query.trim() !== '' && (
              <Command.Group heading="Search" className="px-1 pt-2 text-xs text-muted-foreground">
                <Command.Item
                  value={`records ${query}`}
                  onSelect={() => go(`/records?id=${encodeURIComponent(query.trim())}`)}
                  className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
                >
                  Records with the id “{query.trim()}”
                </Command.Item>
                <Command.Item
                  value={`text ${query}`}
                  onSelect={() => go(`/records?q=${encodeURIComponent(query.trim())}`)}
                  className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
                >
                  Records containing “{query.trim()}”
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
