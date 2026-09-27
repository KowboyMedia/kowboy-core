// Asks each credential the agents' environment holds whether it still answers, so a refused token
// is the first line of a session, not a surprise mid-task (question 87 was found mid-task). Run by
// .claude/hooks/context.sh at session start. Read-only, one short request per credential, never
// fails: a credential that is not set is reported as such and skipped.
const TIMEOUT_MS = 5000;

async function probe(name, url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.ok) return `${name}: answers`;
    if (response.status === 401 || response.status === 403)
      return `${name}: REFUSED (${response.status}), the token needs replacing`;
    return `${name}: unexpected answer ${response.status}`;
  } catch (error) {
    return `${name}: unreachable (${error.name === 'AbortError' ? 'timeout' : error.message})`;
  } finally {
    clearTimeout(timer);
  }
}

const env = process.env;
const checks = [];

if (env.DIGITALOCEAN_ACCESS_TOKEN) {
  checks.push(
    probe('DigitalOcean (DIGITALOCEAN_ACCESS_TOKEN)', 'https://api.digitalocean.com/v2/account', {
      headers: { authorization: `Bearer ${env.DIGITALOCEAN_ACCESS_TOKEN}` },
    }),
  );
} else checks.push('DigitalOcean (DIGITALOCEAN_ACCESS_TOKEN): not set');

if (env.CLOUDWAYS_EMAIL && env.CLOUDWAYS_API_KEY) {
  checks.push(
    probe(
      'Cloudways (CLOUDWAYS_EMAIL, CLOUDWAYS_API_KEY)',
      'https://api.cloudways.com/api/v1/oauth/access_token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: env.CLOUDWAYS_EMAIL, api_key: env.CLOUDWAYS_API_KEY }),
      },
    ),
  );
} else checks.push('Cloudways (CLOUDWAYS_EMAIL, CLOUDWAYS_API_KEY): not set');

if (env.VITEC_USERNAME && env.VITEC_PASSWORD && env.VITEC_OFFICE_ID) {
  const base = (env.VITEC_BASE_URL ?? 'https://connect.maklare.vitec.net').replace(/\/$/, '');
  const url = `${base}/Advertising/Estate/${encodeURIComponent(env.VITEC_OFFICE_ID)}?paging.pageSize=1&paging.pageIndex=0`;
  checks.push(
    probe('Vitec test account (VITEC_USERNAME, VITEC_PASSWORD, VITEC_OFFICE_ID)', url, {
      headers: {
        authorization: `Basic ${Buffer.from(`${env.VITEC_USERNAME}:${env.VITEC_PASSWORD}`).toString('base64')}`,
      },
    }),
  );
} else checks.push('Vitec test account (VITEC_USERNAME, VITEC_PASSWORD, VITEC_OFFICE_ID): not set');

if (env.POSTMARK_SERVER_TOKEN) {
  checks.push(
    probe('Postmark (POSTMARK_SERVER_TOKEN)', 'https://api.postmarkapp.com/server', {
      headers: { accept: 'application/json', 'x-postmark-server-token': env.POSTMARK_SERVER_TOKEN },
    }),
  );
} else checks.push('Postmark (POSTMARK_SERVER_TOKEN): not set');

console.log('Credentials in this environment:');
for (const line of await Promise.all(checks)) console.log(`- ${line}`);
