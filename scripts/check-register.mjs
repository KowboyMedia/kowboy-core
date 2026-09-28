// Warning (never blocks): the registers are consistent. Two sessions running side by side have
// taken the same question number more than once; this reports it when their work is combined.
// docs/open-questions.md: every "## N." heading unique, and the header's "Next number" above them
// all. docs/known-bugs.md: every "## N." heading unique.
import { readFileSync } from 'node:fs';
import { report } from './lib/report.mjs';

const violations = [];

function headings(file) {
  const text = readFileSync(file, 'utf8');
  const numbers = [...text.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]));
  const seen = new Set();
  for (const n of numbers) {
    if (seen.has(n)) violations.push(`${file}: number ${n} is used by two entries`);
    seen.add(n);
  }
  return { text, numbers };
}

const questions = headings('docs/open-questions.md');
const next = questions.text.match(/Next number: (\d+)/);
if (!next) {
  violations.push('docs/open-questions.md: the header names no "Next number: N"');
} else {
  const highest = Math.max(0, ...questions.numbers);
  if (Number(next[1]) <= highest) {
    violations.push(
      `docs/open-questions.md: "Next number: ${next[1]}" is not above the highest open question, ${highest}`,
    );
  }
}

headings('docs/known-bugs.md');

report('registers consistent', violations);
