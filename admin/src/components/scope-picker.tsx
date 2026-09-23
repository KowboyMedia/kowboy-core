// One scope picker, used by Manual sync and by the Records filters (Patric, 2026-09-21: pick a
// tenant, then its connection, then that connection's office, then the entity — do not type ids).
// Both pages read the same options in one call and produce the same shape, so a scope built on one
// page means exactly what it means on the other.
import { useCustom } from '@refinedev/core';
import { Label, Select } from '@/components/ui/input';

export type ScopeValue = {
  tenantId?: string;
  connectionId?: string;
  officeId?: string;
  datatype?: string;
};

type ScopeOptions = {
  tenants: {
    id: number;
    name: string;
    connections: { id: string; provider: string; offices: string[] }[];
  }[];
  datatypes: string[];
};

export function useScopeOptions(): ScopeOptions {
  const { result } = useCustom<ScopeOptions>({ url: '/scope', method: 'get' });
  return { tenants: result?.data?.tenants ?? [], datatypes: result?.data?.datatypes ?? [] };
}

/** The narrower pickers only offer what the wider ones leave possible. */
export function ScopePicker({
  value,
  onChange,
  options,
  everything = 'every tenant',
}: {
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
  options: ScopeOptions;
  /** What the first picker's empty choice says. */
  everything?: string;
}) {
  const tenant = options.tenants.find((one) => String(one.id) === value.tenantId);
  const connections = tenant?.connections ?? [];
  const connection = connections.find((one) => one.id === value.connectionId);
  // Without a connection chosen, offer every office of the tenant's connections.
  const offices = [
    ...new Set((connection ? [connection] : connections).flatMap((one) => one.offices)),
  ].sort();

  // Narrowing the wider picker drops whatever the narrower ones held, so a scope is never a
  // tenant with another tenant's connection under it.
  const pick = (next: ScopeValue): void => onChange(next);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-tenant">Tenant</Label>
        <Select
          id="scope-tenant"
          value={value.tenantId ?? ''}
          onChange={(event) => pick({ datatype: value.datatype, tenantId: event.target.value })}
        >
          <option value="">{everything}</option>
          {options.tenants.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-connection">CRM connection</Label>
        <Select
          id="scope-connection"
          value={value.connectionId ?? ''}
          disabled={connections.length === 0}
          onChange={(event) =>
            pick({
              tenantId: value.tenantId,
              datatype: value.datatype,
              connectionId: event.target.value,
            })
          }
        >
          <option value="">
            {value.tenantId === undefined || value.tenantId === ''
              ? 'choose a tenant first'
              : 'every connection of this tenant'}
          </option>
          {connections.map((one) => (
            <option key={one.id} value={one.id}>
              {one.id} ({one.provider})
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-office">Office</Label>
        <Select
          id="scope-office"
          value={value.officeId ?? ''}
          disabled={offices.length === 0}
          onChange={(event) => pick({ ...value, officeId: event.target.value })}
        >
          <option value="">
            {offices.length === 0 ? 'choose a tenant first' : 'every office'}
          </option>
          {offices.map((office) => (
            <option key={office} value={office}>
              {office}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-datatype">Entity type</Label>
        <Select
          id="scope-datatype"
          value={value.datatype ?? ''}
          onChange={(event) => pick({ ...value, datatype: event.target.value })}
        >
          <option value="">every entity</option>
          {options.datatypes.map((datatype) => (
            <option key={datatype} value={datatype}>
              {datatype}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
