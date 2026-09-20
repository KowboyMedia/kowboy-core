// The command palette (⌘K): jump to a page, a tenant or a record by what is typed.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Provider, SearchResult } from '@/api/types';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const PAGES = [
  ['Dashboard', '/'],
  ['Tenants', '/tenants'],
  ['New tenant', '/tenants/new'],
  ['Records', '/records'],
  ['Jobs', '/jobs'],
  ['Events', '/events'],
  ['Settings', '/settings'],
] as const;

export function Palette({
  open,
  onOpenChange,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Provider[];
}) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [needle, setNeedle] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setNeedle(text.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [text]);
  const found = useQuery({
    queryKey: ['search', needle],
    queryFn: () => api<SearchResult>(`/v1/admin/search?q=${encodeURIComponent(needle)}`),
    enabled: needle.length > 0,
  });
  const go = (to: string): void => {
    onOpenChange(false);
    setText('');
    navigate(to);
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="A page, a tenant, or a record id…"
          value={text}
          onValueChange={setText}
        />
        <CommandList>
          <CommandEmpty>
            {needle && !found.isPending ? 'Nothing matches.' : 'Type to search.'}
          </CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.filter(
              ([label]) => !needle || label.toLowerCase().includes(needle.toLowerCase()),
            ).map(([label, to]) => (
              <CommandItem key={to} value={`page ${label}`} onSelect={() => go(to)}>
                {label}
              </CommandItem>
            ))}
            {providers
              .filter((provider) => !needle || provider.provider.includes(needle.toLowerCase()))
              .map((provider) => (
                <CommandItem
                  key={provider.provider}
                  value={`crm ${provider.provider}`}
                  onSelect={() => go(`/crm/${provider.provider}`)}
                >
                  CRM: {provider.provider}
                </CommandItem>
              ))}
          </CommandGroup>
          {(found.data?.tenants.length ?? 0) > 0 && (
            <CommandGroup heading="Tenants">
              {found.data?.tenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={`tenant ${tenant.id}`}
                  onSelect={() => go(`/tenants/${tenant.id}`)}
                >
                  #{tenant.id} {tenant.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {(found.data?.records.length ?? 0) > 0 && (
            <CommandGroup heading="Records">
              {found.data?.records.map((record) => (
                <CommandItem
                  key={`${record.connection_id}/${record.datatype}/${record.remote_id}`}
                  value={`record ${record.connection_id} ${record.datatype} ${record.remote_id}`}
                  onSelect={() =>
                    go(
                      `/records/${encodeURIComponent(record.connection_id)}/${record.datatype}/${encodeURIComponent(record.remote_id)}`,
                    )
                  }
                >
                  {record.datatype} {record.remote_id}{' '}
                  <span className="text-muted-foreground">· {record.connection_id}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
