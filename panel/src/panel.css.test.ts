// The panel's stylesheet gives each class one rule of its own. A second rule for the same class,
// written for another page, restyles the first page's element as well: the Records list's tick
// box rule once narrowed the sign-in page's "Keep me signed in" line to 18 px.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8');

/**
 * The classes that open a rule of their own at the top level, once for each such rule; a class
 * last in a list of selectors shares its rule and is left out.
 */
function ownRules(text: string): string[] {
  return [...text.matchAll(/(?<!,\n)^\.([\w-]+) \{$/gm)].map((match) => match[1] ?? '');
}

describe("the panel's stylesheet", () => {
  it('finds the rules it counts', () => {
    expect(ownRules('.k-a {\n}\n.k-b,\n.k-a {\n}\n  .k-a {\n  }\n.k-a {\n}\n')).toEqual([
      'k-a',
      'k-a',
    ]);
    expect(ownRules(css).length).toBeGreaterThan(100);
  });

  it('gives no class two rules of its own', () => {
    const seen = new Set<string>();
    const twice = ownRules(css).filter((name) => seen.has(name) || !seen.add(name));
    expect(twice).toEqual([]);
  });
});
