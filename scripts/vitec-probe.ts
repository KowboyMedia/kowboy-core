// Runs the Vitec adapter's HTTP client against the real Connect, read-only, to settle what the
// documentation leaves open (docs/open-questions.md, 18): where page numbering starts, what a
// record by id returns for an estate withdrawn from the website, and whether a made-up id is a 404.
//
//   VITEC_USERNAME, VITEC_PASSWORD   the Connect key pair
//   VITEC_OFFICE_ID                  one office (customer id, M30011 and the like)
//   VITEC_ESTATE_ID                  optional: an estate withdrawn from the website
//   NODE_USE_ENV_PROXY=1             in a cloud session, so fetch goes through the proxy
//
//   npm run build && node dist/scripts/vitec-probe.js
import { getOne, page, VitecError, type Page } from '../adapters/vitec/api.js';

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const auth = { username: env('VITEC_USERNAME'), password: env('VITEC_PASSWORD') };
const office = env('VITEC_OFFICE_ID');

const ids = (result: Page | null): string[] => (result?.rows ?? []).map((row) => row.id ?? '?');
const describe = (label: string, result: Page | null): void =>
  console.log(
    `${label}: index ${result?.index}, count ${result?.count}, total ${result?.totalRowCount}, ids ${ids(result).join(', ') || '(none)'}`,
  );

const first = await page(auth, 'property', office, 0, undefined, 2);
const second = await page(auth, 'property', office, 1, undefined, 2);
describe('page 0', first);
describe('page 1', second);
const same = ids(first).length > 0 && ids(first).join() === ids(second).join();
console.log(
  same
    ? 'paging: page 0 and page 1 are the same, so numbering starts at 1'
    : 'paging: page 0 and page 1 differ, so numbering starts at 0',
);

async function status(label: string, id: string): Promise<void> {
  try {
    const record = await getOne(auth, 'property', office, id);
    console.log(
      `${label}: ${record === null ? 'HTTP 404, gone' : `HTTP 200, ${JSON.stringify(record).length} bytes`}`,
    );
  } catch (error) {
    console.log(
      `${label}: ${error instanceof VitecError ? `HTTP ${error.status}` : String(error)}`,
    );
  }
}

const listed = ids(first)[0];
if (listed) await status(`listed estate ${listed}`, listed);
await status('made-up estate id', 'OBJ0_0');
const withdrawn = process.env['VITEC_ESTATE_ID'];
if (withdrawn) await status(`estate ${withdrawn}, withdrawn from the website`, withdrawn);
