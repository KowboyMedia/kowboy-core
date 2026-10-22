// DigitalOcean's API for the scripts that make and remove temporary servers (the restore drill, the
// load test). The key comes from DIGITALOCEAN_ACCESS_TOKEN; nothing here prints a setting.

const API = 'https://api.digitalocean.com/v2';
export const MINUTE = 60_000;

/** The key, or the script stops with the line that says it is missing. */
export function accessToken() {
  const token = process.env['DIGITALOCEAN_ACCESS_TOKEN'];
  if (!token) {
    console.error('DIGITALOCEAN_ACCESS_TOKEN must be set');
    process.exit(1);
  }
  return token;
}

/** One call to the API: its JSON answer, or an error naming the call and the status. */
export async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken()}`, 'content-type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`DigitalOcean answered ${response.status} to ${init.method ?? 'GET'} ${path}`);
  }
  return response.status === 204 ? null : response.json();
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ask `test` every `everyMs` until it gives a value, for at most `forMs`. */
export async function until(what, test, everyMs, forMs) {
  const end = Date.now() + forMs;
  for (;;) {
    const value = await test();
    if (value) return value;
    if (Date.now() > end) throw new Error(`${what}: not so after ${forMs / MINUTE} minutes`);
    await wait(everyMs);
  }
}

/** The database server by that name, or null. */
export const clusterNamed = async (name) =>
  ((await api('/databases')).databases ?? []).find((cluster) => cluster.name === name) ?? null;

/** A log of what a script did, each line stamped with the time, printed as it goes. */
export function logbook() {
  const lines = [];
  const say = (line) => {
    const stamped = `${new Date().toISOString().slice(11, 19)} ${line}`;
    lines.push(stamped);
    console.log(stamped);
  };
  return { lines, say };
}

export const words = (error) => (error instanceof Error ? error.message : String(error));
