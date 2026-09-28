---
name: plan
description: Plan one item of docs/next-steps.md before building it. Use before any change that is more than one sentence, touches a protected path or the contract, or spans more than one component.
---

# Plan an item

**Intention.** Thinking happens in the plan; building executes a plan Patric could have read. A
fresh session must be able to build from the plan alone.

1. **Read first.** The item; the strategy sections it touches; every `docs/decisions.md` line for
   its component (search the tag); the acceptance criteria it serves; open questions on it. A
   feature larger than one item goes through the discover skill first.
2. **Look two items ahead.** Name the decisions this item and the next two will need and bring
   them now as Decides, with a recommendation each, so no later session stops on them.
3. **Anything visible is agreed before it is built**: a reference page, a sketch or a staging
   page Patric can look at, and one Decide: "build it like this? yes or no".
4. **Write the plan into the item** in `docs/next-steps.md`:
   - the component, one; if the item needs two, it is two items in dependency order
   - what changes for the product, one sentence in Patric's words
   - the test that proves it, named (an existing `AC n`, or a new test the item adds)
   - the interface touched: none, additive, or breaking (then expand → migrate → contract as
     separate releases, each its own item)
   - the unknowns; each gets a time-boxed spike first, whose code is thrown away
   - the Decides it needs, numbered in the register, and the Defaults it takes, stated
   - what it explicitly does not do, and where a request outside the item went (a "Later" item)
   - its size in sessions: one, a few, many
5. **Order the work** unknowns first, then the smallest vertical slice that can be verified end to
   end, then widen.
6. **Size to one session.** An item that will not finish in one session is split, and the first
   unblocked part is taken.
7. **Mark it** "in progress" with the date, so no other session takes it.

**Done when** the plan names the test that will prove the item, a fresh session could build from
it without this chat, and every Decide in it is in the register.
