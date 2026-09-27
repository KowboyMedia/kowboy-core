---
name: build
description: Build one planned item - code, tests and docs in one component. Use while implementing an item of docs/next-steps.md that has a plan.
---

# Build

**Intention.** The smallest change that makes the named test pass, in the shape a reader of this
codebase expects, leaving the repository cleaner than it was found.

**Order.** Interface (types, schema) → the failing test or golden master → the implementation →
the docs, all in the same change.

**Rules**

- **One component.** Touching another is a new item, or the plan was wrong: go back to the plan.
- **Search before writing.** Find the existing function or pattern and reuse or extend it; one code
  path per concern; no second way to do the same thing.
- **The framework's way.** Use libraries as their documentation says; no wrappers, no home-made
  layers, no flags for cases that do not exist yet.
- **Configuration** comes from the environment, is validated at startup with a message that says
  what is wrong, and secrets are never in code, logs or chat.
- **Errors fail loudly** with their cause; nothing is caught and swallowed.
- **Anything that runs unattended writes events** with an id that connects them, so a session can
  see what happened.
- **Tests** are deterministic (time is controlled, nothing sleeps or races), independent of each
  other, fast, and run against the real local services the session has rather than mocks; a
  transformation has golden masters; expected output is never edited to pass; nothing is skipped.
- **Delete rather than comment out**, and leave every touched file free of warnings.
- **Save often**, with a message that says what changed for the product.
- **Two failed fixes end the attempt**: write what was tried into the item and hand it to a fresh
  session.

**Done when** the named test passes, the enforced checks are green, touched files have no
warnings, the README and every text a user reads tell the truth, the item in `docs/next-steps.md`
says what remains, and each structural choice has its `docs/decisions.md` line.
