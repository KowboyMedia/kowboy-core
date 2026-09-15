// Enforced check 1 (strategy §3.1): a skipped test counts as a failure.
// `.only` fails too: it silently skips every other test in the file.
import { readFileSync } from 'node:fs';
import { walk } from './lib/walk.mjs';
import { report } from './lib/report.mjs';

const PATTERNS = [
  [/\b(?:describe|it|test)\.skip\b/, 'a skipped test'],
  [/\b(?:describe|it|test)\.todo\b/, 'a todo test'],
  [/\b(?:describe|it|test)\.only\b/, 'an .only test, which skips the rest of the file'],
  [/\bxit\s*\(|\bxdescribe\s*\(/, 'a skipped test'],
];

const violations = [];
for (const file of walk('.', ['.test.ts'])) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      for (const [pattern, why] of PATTERNS) {
        if (pattern.test(line)) violations.push(`${file}:${index + 1} has ${why}`);
      }
    });
}

report('no skipped tests', violations);
