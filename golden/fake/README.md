# golden/fake

Dummy golden masters for the fake adapters. Agents own this directory (AGENTS.md rule 3); real
golden masters per CRM arrive from Kowboy at Gate 3 and are protected.

Each case is one directory:

```
golden/fake/<datatype>/<case>/
  payload.json     the CRM payload, untouched, in the fake-webhook adapter's shape
  canonical.json   the universal model the mapper and rules must produce, without `display`
  display.json     the `display` object, which is part of the same `data` in production
```

**The `fake_*` fields are dummy.** The universal model has no descriptive fields yet, because no
CRM data model has been read (see `docs/field-tables.md`). Nothing here says what a real property
or office looks like, and none of it should be copied into `schemas/`.

`display.json` is `{}` in every case: there are no business rules yet, and inventing formatting
would be a guess. The day the rules ledger defines one, these files are where it shows up.
