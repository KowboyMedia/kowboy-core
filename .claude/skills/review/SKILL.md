---
name: review
description: Review a change with fresh context before it is reported done to Patric. Use as a subagent that did not build the change, or when Patric asks for a review of a change, a pull request or a page.
---

# Review

**Intention.** Only correct, minimal work reaches Patric. The reviewer reports what changes
correctness or a requirement, never taste, so the builder is not sent to gold-plate.

**Check, in this order** (report only failures, each with its fix)

1. **Does it do what the item and its acceptance criterion say, and nothing more?** Where the
   result is visible, compare it with the reference side by side.
2. **Boundaries.** A component knowing something beyond its interface; a protected path changed
   without a Decide.
3. **Duplication.** Logic that already existed elsewhere; a second code path for one concern.
4. **Tests.** Would they fail if the feature broke; do they test behaviour, not the implementation;
   anything skipped, flaky, timed or edited to pass.
5. **Data and contract.** A breaking change outside expand → migrate → contract; a field or rule
   with no written source.
6. **Security.** Secrets, injection, an endpoint without authentication, personal data in logs.
7. **Failure modes.** Bad input, timeout, partial failure: what happens, and is it visible.
8. **Truth.** README, user-facing text, `docs/next-steps.md` and `docs/decisions.md` updated.

**Output.** At most ten lines, each `[component] what is wrong · why it matters · the fix`. "No
findings" is a complete answer.
