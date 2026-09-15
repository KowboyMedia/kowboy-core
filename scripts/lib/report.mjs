/** Print violations and exit non-zero, or print the pass line. */
export function report(name, violations) {
  if (violations.length === 0) {
    console.log(`✓ ${name}`);
    return;
  }
  console.error(`✗ ${name}: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
