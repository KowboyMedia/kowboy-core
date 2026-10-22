// The smoke suite (AC 18): after every staging deploy, a few requests to the version now live say
// that it answers as a whole: the database and its layout (`/v1/ready`), no check that means Core
// is down for every customer (`/v1/health`), the admin app built and served, and the sites' API
// guarding its door. `node dist/main.js smoke` runs it as the deploy's last step (the job "smoke"
// in .do/app.staging.yaml), and its lines go into the deploy's log. It reads nothing private and
// changes nothing.

/** One request of the suite and what its answer must be. */
type Check = { path: string; expect: (response: Response) => Promise<string | null> };

const status =
  (wanted: number, what: string) =>
  async (response: Response): Promise<string | null> =>
    response.status === wanted ? null : `${what}: answered ${String(response.status)}`;

const CHECKS: Check[] = [
  { path: '/v1/ready', expect: status(200, 'the database or its layout is not ready') },
  {
    path: '/v1/health',
    expect: status(200, 'a check that means Core is down for every customer fails'),
  },
  {
    path: '/admin',
    expect: async (response) =>
      response.status === 200 && (response.headers.get('content-type') ?? '').includes('text/html')
        ? null
        : `the admin app is not served: answered ${String(response.status)}`,
  },
  { path: '/v1/changes', expect: status(401, 'the sites’ API answers without a token') },
];

/** How often the suite is tried while a new version settles, and the wait between tries. */
const TRIES = 6;
const WAIT_MS = 10_000;

/** One pass of the suite: a line per failing check, none when every check passes. */
async function pass(baseUrl: string): Promise<string[]> {
  const failures: string[] = [];
  for (const check of CHECKS) {
    try {
      const response = await fetch(new URL(check.path, baseUrl), { redirect: 'manual' });
      const failure = await check.expect(response);
      await response.body?.cancel();
      if (failure) failures.push(`${check.path}: ${failure}`);
    } catch (error) {
      failures.push(`${check.path}: no answer (${String(error)})`);
    }
  }
  return failures;
}

/**
 * The suite against the Core at `baseUrl`, tried again while it fails, up to `tries` times:
 * the failing checks of the last try, none when the deploy answers as a whole.
 */
export async function smoke(baseUrl: string, tries = TRIES, waitMs = WAIT_MS): Promise<string[]> {
  let failures: string[] = [];
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    failures = await pass(baseUrl);
    if (failures.length === 0 || attempt === tries) break;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return failures;
}

/** The suite's result as lines for the deploy's log. */
export function smokeInWords(baseUrl: string, failures: string[]): string[] {
  if (failures.length === 0) {
    return [`Smoke suite: ${String(CHECKS.length)} checks against ${baseUrl}, all pass.`];
  }
  return [
    `Smoke suite: ${String(failures.length)} of ${String(CHECKS.length)} checks against ${baseUrl} fail.`,
    ...failures.map((failure) => `Fails: ${failure}`),
  ];
}
