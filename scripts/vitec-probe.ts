// Runs the Vitec adapter's HTTP client against the real Connect, read-only, and prints what the
// documentation leaves open (docs/open-questions.md, 18): how Connect writes its dates and ids,
// and what it answers for one estate by id, whether that estate is published or not.
//
//   VITEC_USERNAME, VITEC_PASSWORD   the Connect key pair
//   VITEC_OFFICE_ID                  one office (customer id, M30011 and the like)
//   VITEC_ESTATE_ID                  optional: an estate to look at, one Vitec no longer publishes
//   NODE_USE_ENV_PROXY=1             in a cloud session, so fetch goes through the proxy
//
//   npm run build && node dist/scripts/vitec-probe.js
import { getOne, list, page, VitecError } from '../adapters/vitec/api.js';

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const auth = { username: env('VITEC_USERNAME'), password: env('VITEC_PASSWORD') };
const office = env('VITEC_OFFICE_ID');

type Estate = {
  status?: { id?: string };
  marketing?: { isPublished?: boolean };
  changedAt?: string;
};

const first = await page(auth, 'property', office, 0, undefined, 1);
console.log(
  `estate list: index ${first?.index}, count ${first?.count} (pages), total ${first?.totalRowCount}, first changedAt ${first?.rows?.[0]?.changedAt}`,
);
for await (const row of list(auth, 'office', office)) {
  console.log(`office record ${row.id} for customer id ${row.customerId}`);
}

async function describe(label: string, id: string): Promise<void> {
  let listed = false;
  for await (const row of list(auth, 'property', office)) {
    if (row.id.toLowerCase() === id.toLowerCase()) listed = true;
  }
  try {
    const estate = (await getOne(auth, 'property', office, id)) as Estate | null;
    const answer =
      estate === null
        ? 'HTTP 404, gone'
        : `HTTP 200, status ${estate.status?.id}, isPublished ${estate.marketing?.isPublished}, changedAt ${estate.changedAt}`;
    console.log(`${label}: ${listed ? 'in' : 'not in'} the published list; by id: ${answer}`);
  } catch (error) {
    console.log(
      `${label}: ${error instanceof VitecError ? `HTTP ${error.status}` : String(error)}`,
    );
  }
}

await describe('made-up estate id', 'OBJ0_0');
const given = process.env['VITEC_ESTATE_ID'];
if (given) await describe(`estate ${given}`, given);
