---
name: discover
description: Agent-led discovery - work out the features, the decisions and the risks a project or a larger feature needs, and guide Patric through the decisions in short rounds with a recommended answer each. Use at the start of a project, before any feature larger than one item, and whenever Patric describes a wish rather than a plan.
---

# Discover

**Intention.** Patric describes what he wants in his words; the agent turns it into the decisions
that must be made, brings them one round at a time with a recommendation, and writes the plan from
the answers. He decides; he never has to know which decisions exist.

1. **Read everything he gave**: the concept, the spec, the reference sites or systems, the data,
   and for a feature the strategy and the decisions that bind it. Ask nothing yet.
2. **Write the feature map** into `docs/strategy.md` (section "Features"): each high-level feature
   in one sentence of user value, marked now (the smallest version that is useful) or later, with
   the acceptance criteria it will need. What is explicitly out stands in its own list.
3. **Write the decision list**: every product and architecture decision the map needs. For each:
   the question in plain words; at most three options, one clause of consequence each; whether it
   can be undone later; the recommended answer and why in one clause. Typical rows: who the users
   are and what they do first; the components and their boundaries; where data lives and who owns
   it; what is built and what is bought or reused; hosting and cost; what "done" means for the
   first release; what is deliberately not built.
4. **Name the risks and unknowns**: what could make the plan wrong, and the cheapest way to find out
   (a time-boxed spike, a question to a third party, a look at real data). Unknowns go first in the
   order of work.
5. **Guide the rounds.** Bring the decisions in rounds of at most five, the most binding first
   (boundaries and data before technology, technology before details), each a Decide with its
   register number, its options and the recommendation marked; "ok" takes every recommendation in
   the round. Record each answer in `docs/decisions.md` as it comes; a round's answers can change
   the next round, so the list is revised between rounds.
6. **Write the plan from the answers**: the strategy sections the answers settle, the acceptance
   criteria numbered, the order of work in `docs/next-steps.md`, sized in sessions (one, a few,
   many). The first item is the riskiest unknown or the thinnest slice that proves the design end
   to end.

**Done when** every decision the first phase needs has a line in `docs/decisions.md`, the feature
map and the acceptance criteria are in the strategy, and the first item of `docs/next-steps.md`
can be built without a question.
