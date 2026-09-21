// Enforced check 2 (strategy §3.1 E1/E2, AGENTS.md). The seam:
//  - no CRM name in engine/ or clients/
//  - the engine never imports adapter code
//  - adapters import engine/adapter-api/ only
//  - main.ts is the only file importing both sides
//  - "Kore" (the old product name) appears only under docs/inputs/
//  - no CRM name in the admin area's own app (admin/src), which draws every adapter's page from
//    the data the adapter reports and must never know what a CRM is. The journeys under admin/e2e
//    drive a named fake adapter on purpose and are left out, as the acceptance tests are.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, normalize, join } from 'node:path';
import { walk } from './lib/walk.mjs';
import { report } from './lib/report.mjs';

const CRM_NAMES = ['vitec', 'mspecs'];
const CODE = ['.ts', '.js', '.mjs', '.php'];
const ADAPTER_API = 'engine/adapter-api/';

const specifiers = (source) =>
  [...source.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

const resolve = (file, specifier) =>
  specifier.startsWith('.') ? normalize(join(dirname(file), specifier)) : specifier;

const violations = [];

// 1. No CRM name in the engine, the clients or the admin area's app.
for (const file of [
  ...walk('engine', CODE),
  ...walk('clients', CODE),
  ...walk('admin/src', [...CODE, '.tsx']),
]) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const name of CRM_NAMES) {
      if (line.toLowerCase().includes(name)) {
        violations.push(`${file}:${index + 1} names a CRM ("${name}")`);
      }
    }
  });
}

// 2. Imports across the seam.
for (const file of walk('engine', CODE)) {
  for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
    if (resolve(file, specifier).startsWith('adapters/')) {
      violations.push(`${file} imports adapter code ("${specifier}")`);
    }
  }
}

for (const file of walk('adapters', CODE)) {
  for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
    const target = resolve(file, specifier);
    if (target.startsWith('engine/') && !target.startsWith(ADAPTER_API)) {
      violations.push(
        `${file} imports engine internals ("${specifier}"); only ${ADAPTER_API} is allowed`,
      );
    }
  }
}

// 3. Only main.ts imports both sides. A file inside an adapter importing its own siblings is
// that adapter's own code, not a crossing.
const entrypoint = existsSync('main.ts') ? ['main.ts'] : [];
for (const file of [...walk('engine', CODE), ...walk('adapters', CODE), ...entrypoint]) {
  if (file === 'main.ts') continue;
  const ownAdapter = /^adapters\/[^/]+\//.exec(file)?.[0];
  const targets = specifiers(readFileSync(file, 'utf8')).map((s) => resolve(file, s));
  const importsEngine = targets.some((t) => t.startsWith('engine/'));
  const importsAnotherAdapter = targets.some(
    (t) => t.startsWith('adapters/') && (!ownAdapter || !t.startsWith(ownAdapter)),
  );
  if (importsEngine && importsAnotherAdapter) {
    violations.push(`${file} imports both the engine and an adapter; only main.ts may`);
  }
}

// 4. The old product name in code, schemas and acceptance. Docs may quote it when
// they describe the rename itself.
const renamed = ['engine', 'adapters', 'clients', 'schemas', 'acceptance', ...entrypoint];
for (const file of renamed.flatMap((p) =>
  p.endsWith('.ts') ? [p] : walk(p, [...CODE, '.json', '.sql']),
)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (/\bkore\b/i.test(line)) {
      violations.push(`${file}:${index + 1} writes "Kore"; the product is Kowboy Core`);
    }
  });
}

report('seam', violations);
