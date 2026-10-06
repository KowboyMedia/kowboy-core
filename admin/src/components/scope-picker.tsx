// One scope picker for Records, Flow and Manual sync (Patric, 2026-10-06: tenants, offices,
// entity types and one record id; the same scope on every page). Each box offers only what Core
// holds, read in one call, and several can be ticked; an empty box means all of it.
import { useCustom } from '@refinedev/core';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, Label } from '@/components/ui/input';
import { capital, entity } from '@/lib/format';
import { officeLabel, type Scope, type ScopeOptions } from '@/lib/scope';

export function useScopeOptions(): ScopeOptions {
  const { result } = useCustom<ScopeOptions>({ url: '/scope', method: 'get' });
  return {
    tenants: result?.data?.tenants ?? [],
    offices: result?.data?.offices ?? [],
    datatypes: result?.data?.datatypes ?? [],
  };
}

type Item<T> = { value: T; label: string; group?: string };

/** One box that ticks several of a kind. The button says what is ticked, or that all is. */
function Pick<T extends string | number>({
  id,
  label,
  everything,
  items,
  chosen,
  onChange,
}: {
  id: string;
  label: string;
  /** What the box says while nothing is ticked. */
  everything: string;
  items: Item<T>[];
  chosen: T[];
  onChange: (next: T[]) => void;
}) {
  // An office two tenants hold is one value listed under each; the button names it once.
  const ticked = items.filter(
    (item, index) =>
      chosen.includes(item.value) &&
      items.findIndex((other) => other.value === item.value) === index,
  );
  const said =
    ticked.length === 0
      ? everything
      : ticked.length <= 2
        ? ticked.map((item) => item.label).join(', ')
        : `${ticked[0]?.label ?? ''} and ${String(ticked.length - 1)} more`;
  const groups = [...new Set(items.map((item) => item.group ?? ''))];

  return (
    <div className="flex flex-col gap-1">
      <Label id={`${id}-label`}>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className="w-full justify-between font-normal"
            aria-labelledby={`${id}-label ${id}`}
            disabled={items.length === 0}
          >
            <span className="truncate">{items.length === 0 ? 'nothing to pick yet' : said}</span>
            <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={chosen.length === 0} onSelect={() => onChange([])}>
            {everything}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {groups.map((group) => (
            <div key={group}>
              {groups.length > 1 && group !== '' && <DropdownMenuLabel>{group}</DropdownMenuLabel>}
              {items
                .filter((item) => (item.group ?? '') === group)
                .map((item) => (
                  <DropdownMenuCheckboxItem
                    key={String(item.value)}
                    checked={chosen.includes(item.value)}
                    onSelect={(event) => {
                      // The menu stays open, so several can be ticked in one go.
                      event.preventDefault();
                      onChange(
                        chosen.includes(item.value)
                          ? chosen.filter((value) => value !== item.value)
                          : [...chosen, item.value],
                      );
                    }}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export type ScopeField = 'tenants' | 'offices' | 'datatypes' | 'id';

/**
 * The boxes of a scope: tenants, then the offices of those tenants (every office when no tenant
 * is ticked), then the entity types, then one record id. A tenant unticked takes its offices out
 * of the scope with it, so a scope is never a tenant with another tenant's office under it.
 */
export function ScopePicker({
  value,
  onChange,
  options,
  fields = ['tenants', 'offices', 'datatypes', 'id'],
}: {
  value: Scope;
  onChange: (next: Scope) => void;
  options: ScopeOptions;
  fields?: ScopeField[];
}) {
  const tenantName = (id: number): string =>
    options.tenants.find((tenant) => tenant.id === id)?.name ?? String(id);
  const offices = options.offices.filter(
    (office) => value.tenantIds.length === 0 || value.tenantIds.includes(office.tenantId),
  );
  // An office the address names stays offered when no record lists it any more, so the picker
  // shows the filter the list applies.
  const officeItems: Item<string>[] = [
    ...offices.map((office) => ({
      value: office.id,
      label: officeLabel(options, office.id, office.tenantId),
      group: tenantName(office.tenantId),
    })),
    ...value.officeIds
      .filter((id) => !offices.some((office) => office.id === id))
      .map((id) => ({ value: id, label: `The CRM’s office id ${id}` })),
  ];

  return (
    <>
      {fields.includes('tenants') && (
        <Pick
          id="scope-tenants"
          label="Tenants"
          everything="every tenant"
          items={options.tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
          chosen={value.tenantIds}
          onChange={(tenantIds) =>
            onChange({
              ...value,
              tenantIds,
              officeIds: value.officeIds.filter((id) =>
                options.offices.some(
                  (office) =>
                    office.id === id &&
                    (tenantIds.length === 0 || tenantIds.includes(office.tenantId)),
                ),
              ),
            })
          }
        />
      )}
      {fields.includes('offices') && (
        <Pick
          id="scope-offices"
          label="Offices"
          everything="every office"
          items={officeItems}
          chosen={value.officeIds}
          onChange={(officeIds) => onChange({ ...value, officeIds })}
        />
      )}
      {fields.includes('datatypes') && (
        <Pick
          id="scope-datatypes"
          label="Entity types"
          everything="every entity type"
          items={options.datatypes.map((datatype) => ({
            value: datatype,
            label: capital(entity(datatype, true)),
          }))}
          chosen={value.datatypes}
          onChange={(datatypes) => onChange({ ...value, datatypes })}
        />
      )}
      {fields.includes('id') && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="scope-id">One record, by the CRM’s id</Label>
          <Input
            id="scope-id"
            value={value.remoteId}
            placeholder="any record"
            onChange={(event) => onChange({ ...value, remoteId: event.target.value })}
          />
        </div>
      )}
    </>
  );
}
