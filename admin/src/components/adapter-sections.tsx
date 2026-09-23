// An adapter's own pages, drawn from the data it reports (`AdminSection[]`). The app knows the
// shapes — key-values, a table with row actions, buttons — and nothing about any CRM: no CRM is
// named anywhere in this folder, and the seam check keeps it that way.
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Confirm } from '@/components/confirm';
import { DataTable, type Column } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { moment } from '@/lib/format';

export type AdminField = {
  key: string;
  label: string;
  secret?: boolean;
  help?: string;
  options?: { value: string; label?: string }[];
  required?: boolean;
};

export type AdminValue =
  | string
  | number
  | boolean
  | null
  | { text: string; state: 'ok' | 'bad' | 'warn' | 'muted' }
  | { moment: string | null };

export type AdminAction = {
  id: string;
  label: string;
  /** What the button does and when to press it: shown next to it, never hidden behind a hover. */
  help?: string;
  params?: Record<string, string>;
  fields?: AdminField[];
  confirm?: string;
  danger?: boolean;
};

export type AdminSection = {
  title: string;
  help?: string;
  items?: { label: string; value: AdminValue }[];
  table?: {
    columns: string[];
    rows: { cells: AdminValue[]; actions?: AdminAction[] }[];
    empty?: string;
  };
  actions?: AdminAction[];
};

export type AdminDirections = {
  steps: { title: string; text: string }[];
  settings: { key: string; value: AdminValue; help: string }[];
};

const TONE = { ok: 'ok', bad: 'bad', warn: 'warn', muted: 'muted' } as const;

/** One value, however the adapter described it. */
export function Value({ value }: { value: AdminValue }): ReactNode {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'boolean') {
    return <Badge tone={value ? 'ok' : 'muted'}>{value ? 'yes' : 'no'}</Badge>;
  }
  if (typeof value === 'number') return <span className="tabular-nums">{value}</span>;
  if (typeof value === 'string') return <span className="break-words">{value}</span>;
  if ('moment' in value) {
    return <span className="tabular-nums text-muted-foreground">{moment(value.moment)}</span>;
  }
  return <Badge tone={TONE[value.state]}>{value.text}</Badge>;
}

type Run = (action: AdminAction, params: Record<string, string>) => Promise<{ message: string }>;

/** A button the adapter declared: asks for its fields, confirms when it says to, then runs. */
function Action({ action, run }: { action: AdminAction; run: Run }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const params = { ...(action.params ?? {}), ...values };

  const go = async (): Promise<void> => {
    setBusy(true);
    try {
      const outcome = await run(action, params);
      toast.success(outcome.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const fields = (action.fields ?? []).map((field) => (
    <div key={field.key} className="mt-3 flex flex-col gap-1">
      <Label htmlFor={`${action.id}-${field.key}`}>{field.label}</Label>
      <Input
        id={`${action.id}-${field.key}`}
        type={field.secret ? 'password' : 'text'}
        value={values[field.key] ?? ''}
        onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
      />
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
    </div>
  ));

  if (action.confirm || action.danger || fields.length > 0) {
    return (
      <Confirm
        label={action.label}
        title={action.label}
        what={
          [action.help, action.confirm].filter(Boolean).join(' ') || `This runs “${action.label}”.`
        }
        confirmLabel={action.label}
        variant={action.danger ? 'danger' : 'secondary'}
        size="sm"
        onConfirm={go}
      >
        {fields}
      </Confirm>
    );
  }
  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={() => void go()}>
      {action.label}
    </Button>
  );
}

/** A button with the sentence that says what it does, for the blocks that have room for it. */
function ExplainedAction({ action, run }: { action: AdminAction; run: Run }) {
  return (
    <div className="flex max-w-md flex-col gap-1">
      <div>
        <Action action={action} run={run} />
      </div>
      {action.help && <p className="text-xs text-muted-foreground">{action.help}</p>}
    </div>
  );
}

function SectionTable({ table, run }: { table: NonNullable<AdminSection['table']>; run: Run }) {
  const hasActions = table.rows.some((row) => (row.actions ?? []).length > 0);
  const columns: Column<(typeof table.rows)[number]>[] = table.columns.map((header, index) => ({
    key: `${header}-${String(index)}`,
    header,
    cell: (row) => <Value value={row.cells[index] ?? null} />,
  }));
  if (hasActions) {
    columns.push({
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          {(row.actions ?? []).map((action) => (
            <span key={action.id + JSON.stringify(action.params)} title={action.help}>
              <Action action={action} run={run} />
            </span>
          ))}
        </div>
      ),
      className: 'text-right',
    });
  }
  return (
    <DataTable
      columns={columns}
      rows={table.rows}
      rowKey={(row) => JSON.stringify(row.cells)}
      empty={<Empty what={table.empty ?? 'Nothing here.'} />}
    />
  );
}

/** Every section an adapter reported, in the order it reported them. */
export function AdapterSections({ sections, run }: { sections: AdminSection[]; run: Run }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.help && <CardDescription>{section.help}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {section.items && (
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                {section.items.map((item) => (
                  <div key={item.label} className="contents">
                    <dt className="text-sm text-muted-foreground">{item.label}</dt>
                    <dd className="text-sm">
                      <Value value={item.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {section.table && <SectionTable table={section.table} run={run} />}
            {section.actions && section.actions.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {section.actions.map((action) => (
                  <ExplainedAction key={action.id} action={action} run={run} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** The directions at the top of an adapter's page: the steps, then the settings as they are. */
export function Directions({ directions }: { directions: AdminDirections }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setting it up</CardTitle>
        <CardDescription>What to do, in order, and the settings as they are now.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {directions.steps.map((step) => (
            <li key={step.title}>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,16rem)_1fr]">
          {directions.settings.map((setting) => (
            <div key={setting.key} className="contents">
              <dt className="font-mono text-xs text-muted-foreground">{setting.key}</dt>
              <dd className="text-sm">
                <Value value={setting.value} />
                <p className="text-xs text-muted-foreground">{setting.help}</p>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
