// The shell every page sits in: the navigation on the left with "Go to…" above it and "Sign out"
// under it, each with its sentence (definition of done 4), the environment, version and running
// time in the top bar (§3 B, Should), the command palette, and the toasts.
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useGetIdentity, useLogout } from '@refinedev/core';
import {
  Activity,
  Building2,
  Gauge,
  Inbox,
  List,
  Menu,
  Play,
  Plug,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { openPalette, Palette, shortcut } from '@/components/palette';
import { NAV } from '@/lib/pages';
import { ago } from '@/lib/format';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  activity: Activity,
  search: Search,
  building: Building2,
  play: Play,
  inbox: Inbox,
  list: List,
  plug: Plug,
  settings: Settings,
};

type Me = { email: string; environment: string; version: string; startedAt: string };

export function Layout() {
  const { data: me } = useGetIdentity<Me>();
  const { mutate: logout } = useLogout();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          <Menu aria-hidden="true" />
          {open ? 'Hide the menu' : 'Show the menu'}
        </Button>
        <span className="font-semibold">Kowboy Core</span>
        {me && (
          <Badge tone={me.environment === 'production' ? 'bad' : 'warn'} data-testid="environment">
            {me.environment}
          </Badge>
        )}
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {me ? `Version ${me.version}, started ${ago(me.startedAt)}` : ''}
        </span>
      </header>

      <div className="flex flex-1">
        <nav
          className={cn(
            'w-56 shrink-0 flex-col gap-3 border-r bg-card p-2 md:flex',
            open ? 'flex' : 'hidden',
          )}
          aria-label="Sections"
        >
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="sm" className="justify-start" onClick={openPalette}>
              <Search aria-hidden="true" />
              Go to…
              <kbd className="ml-auto rounded border px-1 text-xs text-muted-foreground">
                {shortcut()}
              </kbd>
            </Button>
            <p className="text-xs text-muted-foreground">
              Finds a page, a tenant, or a record by the CRM’s id for it. {shortcut()} opens it from
              any page.
            </p>
          </div>
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const Icon = ICONS[item.icon] ?? Gauge;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent',
                        isActive && 'bg-accent font-medium',
                      )
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {item.name}
                  </NavLink>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-1 border-t pt-3">
            {me?.email && (
              <p className="break-all text-xs text-muted-foreground">Signed in as {me.email}.</p>
            )}
            <Button variant="outline" size="sm" className="self-start" onClick={() => logout()}>
              Sign out
            </Button>
            <p className="text-xs text-muted-foreground">
              Signs you out on this device only. Your other devices stay signed in.
            </p>
          </div>
        </nav>

        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>
      <Palette />
    </div>
  );
}

/** Every page opens the same way: a name, a line of what it is for, and what it offers. */
export function PageHeader({
  title,
  what,
  children,
}: {
  title: string;
  what: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{what}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
