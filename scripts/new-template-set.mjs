// A new template set from the default one (docs/default-templates.md, "A custom set for a
// client"): a copy of clients/wordpress/templates/kowboy-2026 under the new slug, its main file
// and header renamed, its version reset. Edited as a set of its own from then on.
//
//   npm run new-template-set <slug> [<name>]
import { cpSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'kowboy-2026';
const SOURCE_NAME = 'Kowboy 2026';
const root = join(import.meta.dirname, '..', 'clients', 'wordpress', 'templates');

const slug = process.argv[2] ?? '';
const name = process.argv[3] ?? slug;
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug === SOURCE) {
  console.error(
    'usage: npm run new-template-set <slug, lowercase words joined by dashes> [<name>]',
  );
  process.exit(1);
}
const target = join(root, slug);
if (existsSync(target)) {
  console.error(`${target} exists already`);
  process.exit(1);
}

cpSync(join(root, SOURCE), target, { recursive: true });
renameSync(
  join(target, `core-client-templates-${SOURCE}.php`),
  join(target, `core-client-templates-${slug}.php`),
);
for (const file of [`core-client-templates-${slug}.php`]) {
  const path = join(target, file);
  const text = readFileSync(path, 'utf8')
    .replaceAll(SOURCE_NAME, name)
    .replaceAll(SOURCE, slug)
    .replace(/^(\s*\*\s*Version:\s*)\S+/m, '$10.1.0')
    .replace(/(core_client_register_template_set\('[^']+', '[^']+', __FILE__, ')[^']+/, '$10.1.0');
  writeFileSync(path, text);
}
for (const asset of ['css', 'js']) {
  const from = join(target, 'assets', `${SOURCE}.${asset}`);
  if (existsSync(from)) renameSync(from, join(target, 'assets', `${slug}.${asset}`));
}
console.log(`${target}: the set "${name}" (${slug}), version 0.1.0`);
