import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IGNORED = new Set(['node_modules', 'dist', '.git', 'coverage']);

/** Every file under `dir` whose name ends in one of `extensions`, as repo-relative paths. */
export function walk(dir, extensions) {
  const out = [];
  const visit = (current) => {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED.has(entry)) continue;
      const path = join(current, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (extensions.some((ext) => entry.endsWith(ext))) out.push(path);
    }
  };
  visit(dir);
  return out;
}
