// What an adapter describes as data, drawn with the same parts as every other page: key-values,
// tables with row actions, and buttons. An action with fields asks for them in a dialog; one
// with a confirmation asks first; every outcome is a toast.
import { useState } from 'react';
import { toast } from 'sonner';
import { messageOf } from '@/api/client';
import type { AdminAction, AdminField, AdminSection, AdminValue } from '@/api/types';
import { Section } from '@/components/page';
import { Moment } from '@/components/moment';
import { Kv } from '@/components/kv';
import { Confirm } from '@/components/confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { YesNo } from '@/components/state-badge';

export function Value({ value }: { value: AdminValue }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'boolean') return <YesNo value={value} />;
  if (typeof value === 'number')
    return <span className="tabular-nums">{value.toLocaleString('sv-SE')}</span>;
  if (typeof value === 'string') return <span className="break-words">{value}</span>;
  if ('moment' in value) return <Moment at={value.moment} />;
  const variant =
    value.state === 'ok'
      ? 'ok'
      : value.state === 'bad'
        ? 'bad'
        : value.state === 'warn'
          ? 'warn'
          : 'muted';
  return <Badge variant={variant}>{value.text}</Badge>;
}

export type RunAction = (
  action: AdminAction,
  params: Record<string, string>,
) => Promise<{ message: string }>;

/** The fields an action asks for, in a dialog. */
function FieldsDialog({
  action,
  run,
  onDone,
}: {
  action: AdminAction;
  run: RunAction;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await run(action, { ...action.params, ...values });
      toast.success(result.message);
      onDone();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{action.label}</DialogTitle>
            {action.confirm && <DialogDescription>{action.confirm}</DialogDescription>}
          </DialogHeader>
          {(action.fields ?? []).map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={values[field.key] ?? ''}
              onChange={(value) => setValues((was) => ({ ...was, [field.key]: value }))}
            />
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action.danger ? 'destructive' : 'default'}
              disabled={busy}
            >
              {action.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
  error,
  id,
}: {
  field: AdminField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
}) {
  const inputId = id ?? `field-${field.key}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>
        {field.label}
        {field.required !== false && <span className="text-muted-foreground"> *</span>}
      </Label>
      {field.options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={inputId} aria-invalid={Boolean(error)}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label ?? option.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={inputId}
          type={field.secret ? 'password' : 'text'}
          autoComplete={field.secret ? 'new-password' : 'off'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
        />
      )}
      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : field.help ? (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      ) : null}
    </div>
  );
}

/** One button of a section or a row. */
export function ActionButton({
  action,
  run,
  size = 'sm',
}: {
  action: AdminAction;
  run: RunAction;
  size?: 'sm' | 'default';
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await run(action, action.params ?? {});
      toast.success(result.message);
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  const button = (
    <Button
      type="button"
      size={size}
      variant={action.danger ? 'destructive' : 'outline'}
      disabled={busy}
      onClick={() => (action.fields ? setAsking(true) : action.confirm ? undefined : void go())}
    >
      {action.label}
    </Button>
  );
  if (action.fields) {
    return (
      <>
        {button}
        {asking && <FieldsDialog action={action} run={run} onDone={() => setAsking(false)} />}
      </>
    );
  }
  if (action.confirm) {
    return (
      <Confirm
        title={action.label}
        description={action.confirm}
        action={action.label}
        danger={action.danger}
        onConfirm={go}
      >
        {button}
      </Confirm>
    );
  }
  return button;
}

/** Every section an adapter described. */
export function Sections({ sections, run }: { sections: AdminSection[]; run: RunAction }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <Section
          key={section.title}
          title={section.title}
          help={section.help}
          flush={Boolean(section.table)}
          actions={section.actions?.map((action) => (
            <ActionButton
              key={action.id + JSON.stringify(action.params)}
              action={action}
              run={run}
            />
          ))}
        >
          {section.items && (
            <Kv
              rows={section.items.map((item) => [
                item.label,
                <Value key={item.label} value={item.value} />,
              ])}
            />
          )}
          {section.table &&
            (section.table.rows.length === 0 ? (
              <p className="px-5 text-sm text-muted-foreground">
                {section.table.empty ?? 'Nothing here.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {section.table.columns.map((column) => (
                      <TableHead key={column} className="first:pl-5">
                        {column}
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.table.rows.map((row, index) => (
                    <TableRow key={index}>
                      {row.cells.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} className="first:pl-5">
                          <Value value={cell} />
                        </TableCell>
                      ))}
                      <TableCell className="pr-5 text-right whitespace-nowrap">
                        <span className="inline-flex gap-1">
                          {row.actions?.map((action) => (
                            <ActionButton
                              key={action.id + JSON.stringify(action.params)}
                              action={action}
                              run={run}
                            />
                          ))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </Section>
      ))}
    </div>
  );
}
