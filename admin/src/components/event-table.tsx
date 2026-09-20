// The event log as a table: when, what, whose, and the fields folded until asked for. A record
// links to its page, a correlation id to the chain it started.
import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { EventRow } from '@/api/types';
import { recordPath } from '@/api/queries';
import { Moment } from '@/components/moment';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TONE: Record<string, string> = {
  'entity.dropped': 'text-bad',
  'site.failed': 'text-bad',
  'site.error': 'text-bad',
  'fetch.failed': 'text-bad',
  'schedule.failed': 'text-bad',
  'job.failed': 'text-bad',
  'entity.written': 'text-ok',
  'site.applied': 'text-ok',
};

/** The fields in one line: key=value pairs, long values cut. */
function summary(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .map(
      ([key, value]) =>
        `${key}=${String(value).length > 40 ? `${String(value).slice(0, 40)}…` : String(value)}`,
    )
    .join('  ');
}

function Row({ event, onCorrelation }: { event: EventRow; onCorrelation?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasFields = Object.keys(event.fields).length > 0;
  return (
    <>
      <TableRow
        className={cn(hasFields && 'cursor-pointer')}
        onClick={() => hasFields && setOpen((was) => !was)}
        data-event={event.type}
      >
        <TableCell className="whitespace-nowrap">
          <Moment at={event.at} />
        </TableCell>
        <TableCell className={cn('font-mono text-xs whitespace-nowrap', TONE[event.type])}>
          {event.type}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {event.tenant_id !== null && (
            <Link
              to={`/tenants/${event.tenant_id}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              #{event.tenant_id}
            </Link>
          )}
          {event.connection_id && (
            <span className="ml-1 text-muted-foreground">{event.connection_id}</span>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {event.connection_id && event.datatype && event.remote_id ? (
            <Link
              to={recordPath(event.connection_id, event.datatype, event.remote_id)}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {event.datatype} {event.remote_id}
            </Link>
          ) : (
            event.datatype && <span className="text-muted-foreground">{event.datatype}</span>
          )}
        </TableCell>
        <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
          {summary(event.fields)}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {event.correlation_id && (
            <button
              type="button"
              className="font-mono text-xs text-primary hover:underline"
              title={event.correlation_id}
              onClick={(e) => {
                e.stopPropagation();
                onCorrelation?.(event.correlation_id ?? '');
              }}
            >
              {event.correlation_id.slice(0, 8)}
            </button>
          )}
        </TableCell>
        <TableCell className="w-8 text-muted-foreground">
          {hasFields &&
            (open ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            ))}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7}>
            <pre className="max-h-80 overflow-auto font-mono text-xs whitespace-pre-wrap">
              {JSON.stringify(event.fields, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function EventTable({
  events,
  empty = 'No events.',
  onCorrelation,
}: {
  events: EventRow[];
  empty?: string;
  onCorrelation?: (id: string) => void;
}) {
  if (events.length === 0) return <p className="px-5 text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-5">When</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Tenant · connection</TableHead>
          <TableHead>Record</TableHead>
          <TableHead>Fields</TableHead>
          <TableHead>Chain</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <Row key={event.id} event={event} onCorrelation={onCorrelation} />
        ))}
      </TableBody>
    </Table>
  );
}
