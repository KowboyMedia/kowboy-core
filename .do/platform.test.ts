// The release path as App Platform and GitHub run it (AC 18), read from the platforms themselves:
// staging deploys every change saved to its branch, with the release preview before and the smoke
// suite after; live deploys main only, and its web part has the health check that keeps the
// version running when a new one fails it; and main takes a change only through a pull request
// whose checks pass, so nothing reaches live but what an agent merges on Patric's word. It needs
// DIGITALOCEAN_ACCESS_TOKEN (`npm run test:platform`), reads each app's settings in this process
// and prints none of them. GitHub answers for this public repository without a token.
import { describe, expect, it } from 'vitest';

const STAGING = '57498bcc-59a5-4812-aa1f-ed65c83a5b2f';
const LIVE = 'c322d2df-5ba1-4cdd-82b5-407dbe429310';
const REPOSITORY = 'https://api.github.com/repos/KowboyMedia/kowboy-core';

type Source = { github?: { branch?: string; deploy_on_push?: boolean } };
type Spec = {
  services?: (Source & { name: string; health_check?: { http_path?: string } })[];
  workers?: (Source & { name: string })[];
  jobs?: (Source & { name: string; kind?: string; run_command?: string })[];
};

/** An app's settings, as App Platform holds them. */
async function specOf(appId: string): Promise<Spec> {
  const token = process.env['DIGITALOCEAN_ACCESS_TOKEN'];
  if (!token) throw new Error('this suite reads the platform and needs DIGITALOCEAN_ACCESS_TOKEN');
  const response = await fetch(`https://api.digitalocean.com/v2/apps/${appId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`App Platform answered ${String(response.status)}`);
  return ((await response.json()) as { app: { spec: Spec } }).app.spec;
}

/** Each part of an app with the branch it deploys and whether a saved change deploys it. */
const sources = (spec: Spec): Record<string, { branch?: string; onPush?: boolean }> =>
  Object.fromEntries(
    [...(spec.services ?? []), ...(spec.workers ?? []), ...(spec.jobs ?? [])].map((part) => [
      part.name,
      { branch: part.github?.branch, onPush: part.github?.deploy_on_push },
    ]),
  );

describe('the release path', () => {
  it('deploys staging on every change to its branch, the preview before and the smoke suite after', async () => {
    const spec = await specOf(STAGING);

    expect(sources(spec)).toEqual({
      web: { branch: 'staging', onPush: true },
      worker: { branch: 'staging', onPush: true },
      preview: { branch: 'staging', onPush: true },
      smoke: { branch: 'staging', onPush: true },
    });
    const jobs = Object.fromEntries(
      (spec.jobs ?? []).map((job) => [job.name, [job.kind, job.run_command]]),
    );
    expect(jobs).toEqual({
      preview: ['PRE_DEPLOY', 'sh scripts/start.sh preview'],
      smoke: ['POST_DEPLOY', 'sh scripts/start.sh smoke'],
    });
  });

  it('deploys live from main only, behind a health check that keeps the running version', async () => {
    const spec = await specOf(LIVE);

    for (const [part, source] of Object.entries(sources(spec))) {
      expect([part, source.branch]).toEqual([part, 'main']);
    }
    const web = spec.services?.find((service) => service.name === 'web');
    expect(web?.health_check?.http_path).toBe('/v1/ready');
  });

  it('takes a change to main only through a pull request whose checks pass', async () => {
    const response = await fetch(`${REPOSITORY}/rules/branches/main`, {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub answered ${String(response.status)}`);
    const rules = (await response.json()) as {
      type: string;
      parameters?: { required_status_checks?: { context: string }[] };
    }[];

    // A ruleset on main holds the rule, since GitHub shows a ruleset's rules to anyone and the
    // older branch protection does not say whether it asks for a pull request. The approval
    // itself is Patric's word, on which an agent merges (strategy §4).
    expect(rules.map((rule) => rule.type)).toEqual(
      expect.arrayContaining(['pull_request', 'required_status_checks', 'non_fast_forward']),
    );
    const checks = rules.flatMap(
      (rule) => rule.parameters?.required_status_checks?.map((check) => check.context) ?? [],
    );
    expect(checks).toEqual(
      expect.arrayContaining([
        'Enforced checks (block merge)',
        'WordPress client tests (block merge)',
      ]),
    );
  });
});
