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

`canonical.json` and `display.json` are split so a formatting change shows up in one small file.
Together they are the `data` a subscriber receives.
