// Enforced check 4 (strategy §3.1): no committed secrets. One pattern: a private key block.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { report } from './lib/report.mjs';

const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/;

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const violations = [];

for (const file of tracked) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  content.split('\n').forEach((line, index) => {
    if (PRIVATE_KEY.test(line)) violations.push(`${file}:${index + 1} looks like a private key`);
  });
}

report('no committed secrets', violations);
