// The frame around every page: the navigation, the environment banner, the live indicator, the
// command palette and who is logged in.
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIcon,
  DatabaseIcon,
  GaugeIcon,
  ListChecksIcon,
  LogOutIcon,
  MenuIcon,
  PlugIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';
import { api } from '@/api/client';
import { providersQuery } from '@/api/queries';
import type { Provider, Session } from '@/api/types';
import { useStream } from '@/hooks/useStream';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Palette } from '@/components/palette';
import { cn } from '@/lib/utils';

const PAGES = [
  { to: '/', label: 'Dashboard', icon: GaugeIcon, end: true },
  { to: '/tenants', label: 'Tenants', icon: UsersIcon },
  { to: '/records', label: 'Records', icon: DatabaseIcon },
  { to: '/jobs', label: 'Jobs', icon: ListChecksIcon },
  { to: '/events', label: 'Events', icon: ActivityIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Nav({ providers, onPick }: { providers: Provider[]; onPick?: () => void }) {
  const link = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    );
  return (
    <nav className="flex flex-col gap-1" aria-label="Pages">
      {PAGES.map((page) => (
        <NavLink key={page.to} to={page.to} end={page.end} className={link} onClick={onPick}>
          <page.icon className="size-4" />
          {page.label}
        </NavLink>
      ))}
      {providers.length > 0 && (
        <div className="mt-4 mb-1 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          CRM adapters
        </div>
      )}
      {providers.map((provider) => (
        <NavLink
          key={provider.provider}
          to={`/crm/${provider.provider}`}
          className={link}
          onClick={onPick}
        >
          <PlugIcon className="size-4" />
          {provider.provider}
        </NavLink>
      ))}
    </nav>
  );
}

const ENVIRONMENT_STYLE: Record<string, string> = {
  production: 'bg-bad text-white',
  staging: 'bg-warn text-black',
};

export function Shell({ session, children }: { session: Session; children: React.ReactNode }) {
  const providers = useQuery(providersQuery());
  const stream = useStream(true);
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((was) => !was);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const logout = async (): Promise<void> => {
    await api('/v1/admin/logout', { method: 'POST', body: {} });
    client.clear();
    navigate('/login', { replace: true });
  };

  const list = providers.data ?? [];
  const environment = session.environment;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            K
          </span>
          <div>
            <div className="text-sm font-semibold leading-tight">Core admin</div>
            <div className="text-xs text-muted-foreground">v{session.version}</div>
          </div>
        </div>
        <Nav providers={list} />
        <div className="mt-auto pt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setPalette(true)}
          >
            <SearchIcon /> Search{' '}
            <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open the menu"
          >
            <MenuIcon />
          </Button>
          <span
            data-testid="environment"
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide uppercase',
              ENVIRONMENT_STYLE[environment] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {environment}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                data-testid="stream"
                data-state={stream}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    stream === 'live' ? 'bg-ok' : stream === 'off' ? 'bg-bad' : 'bg-warn',
                  )}
                />
                {stream === 'live' ? 'live' : stream === 'off' ? 'not live' : 'connecting'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {stream === 'live'
                ? 'Pages update as things happen.'
                : 'The live feed is down; pages refresh when you open them.'}
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setPalette(true)}
              aria-label="Search"
            >
              <SearchIcon />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="user-menu">
                  <span className="max-w-48 truncate">{session.user}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Logged in as {session.user}</DropdownMenuLabel>
                {session.maintenanceLogin && (
                  <DropdownMenuLabel className="font-normal">
                    <Badge variant="warn">Email login paused</Badge>
                  </DropdownMenuLabel>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOutIcon /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6">{children}</main>
        <footer className="px-4 py-4 text-xs text-muted-foreground md:px-6">
          Times are Swedish time (Europe/Stockholm); hover one for the moment in UTC.
        </footer>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-4">
          <SheetTitle className="mb-4 px-2">Core admin</SheetTitle>
          <Nav providers={list} onPick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Palette open={palette} onOpenChange={setPalette} providers={list} />
    </div>
  );
}
