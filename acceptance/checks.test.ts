// AC 37: every enforced check fails on a seeded violation, and passes on this repository.
import { execFileSync, execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const repo = join(import.meta.dirname, '..');
const scripts = join(repo, 'scripts');

const seeded: string[] = [];

/** A throwaway repository containing exactly one seeded violation. */
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'core-check-'));
  seeded.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}

const check = async (script: string, cwd: string): Promise<{ code: number; output: string }> => {
  try {
    const { stdout } = await run(process.execPath, [join(scripts, script)], { cwd });
    return { code: 0, output: stdout };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
};

afterEach(() => {
  for (const dir of seeded.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the seam check', () => {
  it('passes on this repository', async () => {
    expect((await check('check-seam.mjs', repo)).code).toBe(0);
  });

  it('fails when the engine names a CRM', async () => {
    const dir = fixture({ 'engine/storage.ts': 'export const note = "vitec sends webhooks";\n' });
    const result = await check('check-seam.mjs', dir);
    expect(result.code).toBe(1);
    expect(result.output).toContain('names a CRM');
  });

  it('fails when an adapter imports engine internals', async () => {
    const dir = fixture({
      'adapters/acme/index.ts':
        "import { db } from '../../engine/storage/db.js';\nexport const x = db;\n",
    });
    const result = await check('check-seam.mjs', dir);
    expect(result.code).toBe(1);
    expect(result.output).toContain('imports engine internals');
  });

  it('fails when the engine imports an adapter', async () => {
    const dir = fixture({
      'engine/oops.ts':
        "import { thing } from '../adapters/acme/index.js';\nexport const x = thing;\n",
    });
    const result = await check('check-seam.mjs', dir);
    expect(result.code).toBe(1);
    expect(result.output).toContain('imports adapter code');
  });

  it('fails when a file other than main.ts imports both sides', async () => {
    const dir = fixture({
      'engine/adapter-api/index.ts': 'export const api = 1;\n',
      'adapters/acme/index.ts':
        "import { api } from '../../engine/adapter-api/index.js';\nimport { other } from '../other/index.js';\nexport const x = [api, other];\n",
      'adapters/other/index.ts': 'export const other = 2;\n',
    });
    const result = await check('check-seam.mjs', dir);
    expect(result.code).toBe(1);
    expect(result.output).toContain('imports both');
  });
});

describe('the skipped-test check', () => {
  // The seeded violations are assembled at runtime: written out literally they would be violations
  // in this file, and the check would fail on the repository it is meant to protect.
  const seededTest = (modifier: string): string => `it${modifier}('later', () => {});\n`;

  it('passes on this repository', async () => {
    expect((await check('check-no-skipped-tests.mjs', repo)).code).toBe(0);
  });

  it('fails on a skipped test', async () => {
    const dir = fixture({ 'engine/thing.test.ts': seededTest('.' + 'skip') });
    const result = await check('check-no-skipped-tests.mjs', dir);
    expect(result.code).toBe(1);
    expect(result.output).toContain('a skipped test');
  });

  it('fails on a test that silently skips the rest of its file', async () => {
    const dir = fixture({ 'engine/thing.test.ts': seededTest('.' + 'only') });
    expect((await check('check-no-skipped-tests.mjs', dir)).code).toBe(1);
  });
});

describe('the secret check', () => {
  it('passes on this repository', async () => {
    expect((await check('check-secrets.mjs', repo)).code).toBe(0);
  });

  it('fails on a committed private key', async () => {
    const dir = fixture({
      'deploy/key.pem':
        '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq\n-----END PRIVATE KEY-----\n',
    });
    const result = await check('check-secrets.mjs', dir);
    expect(result.code).toBe(1);
    expect(result.output).toContain('a private key');
  });

  it('fails on a database URL with a password', async () => {
    const dir = fixture({
      'engine/config.ts': "const url = 'postgres://core:hunter2sekrit@db.internal:5432/core';\n",
    });
    expect((await check('check-secrets.mjs', dir)).code).toBe(1);
  });

  it('allows an obvious placeholder', async () => {
    const dir = fixture({ '.env.example': 'ADMIN_SECRET=changeme\n' });
    expect((await check('check-secrets.mjs', dir)).code).toBe(0);
  });
});
