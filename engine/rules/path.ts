// A dotted path into a record: `address.street`, `buildings[0].energy_declaration.status.name`.
// The sections and the display rules read universal names only (docs/field-tables.md).

export type Data = Record<string, unknown>;

const isRecord = (value: unknown): value is Data =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function read(data: unknown, path: string): unknown {
  let current: unknown = data;
  for (const step of path.split('.')) {
    const match = /^([^[]+)(?:\[(\d+)\])?$/.exec(step);
    if (!match || !isRecord(current)) return undefined;
    current = current[match[1] ?? ''];
    if (match[2] !== undefined)
      current = Array.isArray(current) ? current[Number(match[2])] : undefined;
  }
  return current;
}
