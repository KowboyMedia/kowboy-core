// A zod schema as a react-hook-form resolver, so a form's rules live in one place and the errors
// land on the fields they belong to. Small on purpose: the published resolver package wants an
// older JSON-schema helper than the engine uses.
import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

const setPath = (
  target: Record<string, unknown>,
  path: (string | number)[],
  value: unknown,
): void => {
  let node = target;
  path.forEach((key, index) => {
    const last = index === path.length - 1;
    if (last) {
      node[String(key)] = value;
      return;
    }
    const next = (node[String(key)] as Record<string, unknown> | undefined) ?? {};
    node[String(key)] = next;
    node = next;
  });
};

export const zodResolver =
  <T extends FieldValues>(schema: ZodType<T>): Resolver<T> =>
  async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      setPath(
        errors,
        issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
        {
          type: issue.code,
          message: issue.message,
        },
      );
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };

/** Errors the API returned by field, as the same nested shape. */
export function apiErrorsOf<T extends FieldValues>(errors: Record<string, string>): FieldErrors<T> {
  const nested: Record<string, unknown> = {};
  for (const [path, message] of Object.entries(errors)) {
    setPath(
      nested,
      path.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
      { type: 'server', message },
    );
  }
  return nested as FieldErrors<T>;
}
