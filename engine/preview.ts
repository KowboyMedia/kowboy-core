// The release impact preview (strategy §4, enforced check E5, AC 36). Before a new version takes
// over, its mappers and rules run over every record the database holds, from the stored raw:
// nothing is written, no CRM is called, no migration runs and no login is opened. A record that
// cannot be mapped or does not fit the schema stops the release. `node dist/main.js preview` runs
// it as the release's first step, against the database of the app being released (the job
// "preview" in .do/app.yaml), and its lines go into the release note.
import { inWords, number } from './admin/words.js';
import { recompute, type Progress } from './recompute.js';
import { closeDb, db } from './storage/db.js';

/** How many changed records the preview shows as examples, and how many failures it lists. */
const EXAMPLES = 10;
const FAILURES = 50;

/** The preview over the database at `databaseUrl`, which it opens and closes. */
export async function previewRelease(databaseUrl: string): Promise<Progress> {
  db(databaseUrl);
  try {
    return await recompute({}, { dryRun: true, exampleLimit: EXAMPLES, failureLimit: FAILURES });
  } finally {
    await closeDb();
  }
}

/** A stored value as one short piece of text. */
const short = (value: unknown): string => {
  const text = JSON.stringify(value) ?? 'nothing';
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

/** The preview as lines for the release's log and its release note. */
export function previewInWords(report: Progress): string[] {
  const lines = [
    `Release preview: ${inWords(report.examined, 'record', 'records')} read from the database, nothing written. ${number(report.changed)} would change, ${number(report.unchanged)} stay the same, ${number(report.failed)} fail.`,
  ];
  for (const example of report.examples) {
    const fields = Object.entries(example.changed).map(
      ([field, { from, to }]) => `${field} ${short(from)} becomes ${short(to)}`,
    );
    lines.push(
      `Would change: ${example.datatype} ${example.remoteId} of connection ${example.connectionId}: ${fields.join('; ')}`,
    );
  }
  for (const failure of report.failures) {
    lines.push(
      `Fails: ${failure.datatype} ${failure.remoteId} of connection ${failure.connectionId}: ${failure.errors.join('; ')}`,
    );
  }
  const unlisted = report.failed - report.failures.length;
  if (unlisted > 0) lines.push(`${inWords(unlisted, 'more record fails', 'more records fail')}.`);
  lines.push(
    report.failed === 0
      ? 'The release may go ahead.'
      : `The release stops: ${inWords(report.failed, 'record cannot be mapped or does not fit the schema', 'records cannot be mapped or do not fit the schema')}.`,
  );
  return lines;
}
