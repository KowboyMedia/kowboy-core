// Enforced check 4 (strategy §3.1): no committed secrets.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { report } from './lib/report.mjs';

const PATTERNS = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, 'a private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bghp_[A-Za-z0-9]{36}\b/, 'a GitHub token'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'an API key'],
  // A database URL only carries a secret when it points somewhere real; a URL for a local or CI
  // Postgres holds a throwaway password by definition.
  [
    /\bpostgres(?:ql)?:\/\/[^\s'"]*:[^\s'"@]+@(?!localhost|127\.0\.0\.1|postgres[:/])/,
    'a database URL with a password',
  ],
  [
    /\b(?:secret|token|password|passwd|api_?key|dsn)\b\s*[:=]\s*['"][^'"\s${}]{12,}['"]/i,
    'a hard-coded credential',
  ],
];
// Values that look like credentials but are documentation or test fixtures.
const PLACEHOLDER =
  /(example|placeholder|changeme|xxx+|<[^>]+>|your[-_]|dummy|fake|redacted|\btest[-_]|\.\.\.)/i;

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const violations = [];

for (const file of tracked) {
  if (file.endsWith('.env.example') || file.startsWith('docs/')) continue;
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  content.split('\n').forEach((line, index) => {
    for (const [pattern, what] of PATTERNS) {
      if (pattern.test(line) && !PLACEHOLDER.test(line)) {
        violations.push(`${file}:${index + 1} looks like ${what}`);
      }
    }
  });
}

report('no committed secrets', violations);
