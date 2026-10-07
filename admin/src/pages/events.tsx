// Events (question 168 a, built from zero on 2026-10-07): everything Core did or was told, newest
// first, each step a sentence; or one happening's steps together, oldest first, when a record's
// page or a form links here with its chain. Nothing to type or pick: the record a step is about
// opens its page, and the names in a sentence open their places.
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useList } from '@refinedev/core';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { Explained } from '@/components/explained';
import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { capital, counted, exact } from '@/lib/format';

type Step = {
  id: number;
  at: string;
  /** The record the step is about, by its address or name; no place when Core no longer holds it. */
  about: { label: string; to: string | null } | null;
  said: string;
  /** The names in the sentence, each with its place, the connection before its tenant. */
  places: { text: string; to: string }[];
};

/** Core sends the log in pages of this many steps (STEPS_PAGE in engine/admin/event-log.ts). */
const PAGE_SIZE = 100;

/** A sentence opening with a person's e-mail address keeps it as written. */
const asSentence = (said: string): string => (/^\S+@/.test(said) ? said : capital(said));

/** The sentence with each name it holds as a link to its place, where the name first stands alone. */
function withPlaces(said: string, places: Step['places']): ReactNode {
  const taken: { start: number; end: number; to: string }[] = [];
  for (const place of places) {
    for (let start = said.indexOf(place.text); start >= 0;) {
      const end = start + place.text.length;
      if (taken.every((range) => end <= range.start || start >= range.end)) {
        taken.push({ start, end, to: place.to });
        break;
      }
      start = said.indexOf(place.text, start + 1);
    }
  }
  taken.sort((a, b) => a.start - b.start);
  const pieces: ReactNode[] = [];
  let at = 0;
  for (const range of taken) {
    pieces.push(
      said.slice(at, range.start),
      <Link key={range.start} className="underline" to={range.to}>
        {said.slice(range.start, range.end)}
      </Link>,
    );
    at = range.end;
  }
  pieces.push(said.slice(at));
  return pieces;
}

export function Events() {
  const [params, setParams] = useSearchParams();
  const chain = params.get('correlation');
  const page = Number(params.get('page') ?? 1);

  const { result, query } = useList<Step>({
    resource: 'events',
    pagination: { currentPage: page, pageSize: PAGE_SIZE },
    filters: chain ? [{ field: 'correlation', operator: 'eq' as const, value: chain }] : [],
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Events"
        what={
          chain
            ? 'The steps of one happening, oldest first: a change from a CRM on its way through Core to each site, or a form on its way to the CRM.'
            : 'Everything Core did and was told, newest first: what the CRMs sent, the records Core saved or took off the sites, the sites told of changes and what they fetched, the alerts sent and what people did in this admin area. Open a record to see its own history.'
        }
      />

      {chain && (
        <div className="mb-4">
          <Explained what="Shows every step Core took again, newest first, instead of this one happening.">
            <Button size="sm" variant="outline" onClick={() => setParams(new URLSearchParams())}>
              Show everything
            </Button>
          </Explained>
        </div>
      )}

      <DataTable
        caption={counted(total, 'step', 'steps')}
        columns={[
          {
            key: 'at',
            header: 'When',
            cell: (step) => {
              // On a phone the time goes under the date, never through it.
              const [day, time] = exact(step.at).split(' ');
              return (
                <span className="tabular-nums sm:whitespace-nowrap">
                  <span className="whitespace-nowrap">{day}</span>{' '}
                  <span className="whitespace-nowrap">{time}</span>
                </span>
              );
            },
          },
          {
            key: 'said',
            header: 'What happened',
            cell: (step) => (
              <div className="flex flex-col">
                {step.about &&
                  (step.about.to ? (
                    <Link className="font-medium hover:underline" to={step.about.to}>
                      {capital(step.about.label)}
                    </Link>
                  ) : (
                    <span className="font-medium">{capital(step.about.label)}</span>
                  ))}
                <span>{withPlaces(asSentence(step.said), step.places)}</span>
              </div>
            ),
          },
        ]}
        rows={rows}
        rowKey={(step) => String(step.id)}
        loading={query.isLoading}
        page={{
          page,
          size: PAGE_SIZE,
          total,
          onPage: (next) => {
            const changed = new URLSearchParams(params);
            changed.set('page', String(next));
            setParams(changed, { replace: true });
          },
        }}
        empty={
          <Empty
            what={
              chain
                ? 'Core holds none of these steps any more. The event log keeps each step for as long as Settings says under “The event log keeps”.'
                : 'Nothing is in the event log yet. Everything Core does shows here as it happens.'
            }
          />
        }
      />
    </>
  );
}
