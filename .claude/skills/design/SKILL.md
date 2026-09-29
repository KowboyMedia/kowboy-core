---
name: design
description: Make something people look at come out well-designed without a designer in the loop - a new page, section, component, layout or look, or a restyle. Use when a change creates or restyles a visible surface in a repository that has a design (a DESIGN.md or an agreed reference); skip it for a change inside an existing pattern, text, a field added to a known form, or a bug fix.
---

# Design

**Intention.** Taste lives in assets built once and in a review loop, never in Patric's time. A
visible change either follows the repository's design exactly (no design work) or goes through
the loop below, and Patric only ever picks between finished candidates by looking.

**First, the size of the change**, and stop here when it is small:

- **None.** The change uses the existing components and patterns as they are (text, a field in a
  known form, a bug fix, a list that looks like the other lists): build it, take one screenshot
  desktop and one mobile, compare with a neighbouring page, done.
- **Light.** The change is inside an existing pattern but adds something (a new block on a known
  page): build it against `DESIGN.md`, screenshot desktop and mobile, run the self-check below
  once, done.
- **Full.** A new page, a new section type, a new component, a new layout or a new look: the loop.
- **No design at all.** A repository whose `AGENTS.md` says "Design: none" (an API, a job, an
  internal tool) never enters this skill; its screens follow the framework's defaults.

**The assets, built once per repository**

- `DESIGN.md` at the repository root, a protected path: the palette (4 to 6 named colours), the
  type (1 or 2 named typefaces and a scale), spacing and radius, the component rules, the layout
  patterns, 3 to 5 tone words, an anti-defaults list, and 2 or 3 reference screenshots or links.
- It is derived by an agent from references Patric names (one question: "which 2 or 3 sites or
  screenshots should this look like?"), never written by him; a client project then needs only
  its parameters: logo, palette derived from the logo, photos, copy source.
- Real content from the start: real copy, real photos; placeholders make every layout look cheap.
- The `frontend-design` skill (Anthropic's, installed as a plugin or skill) supplies the taste
  rules when present; the anti-defaults it names are the usual AI tells: identical rounded cards
  with the same soft shadow, all-caps eyebrow labels over every heading, one accented word per
  headline, fade-up animations on every section, arrows on buttons, the same two or three
  palettes everywhere.

**The loop, for a full change**

1. **Plan the tokens and components first** from `DESIGN.md`, and check the plan for genericness
   before building.
2. **Build** one section at a time with real content.
3. **Review with fresh eyes.** A second agent with no memory of building it screenshots desktop
   and mobile (Playwright), scores against the rubric, and returns ordered fixes: hierarchy,
   contrast, spacing rhythm, the anti-defaults list, real content, every state (empty, loading,
   error, long text), keyboard and screen-reader basics. Fix, then review again, at most three
   passes.
4. **Best of two or three.** For a new look, run the loop two or three times with different
   directions from `DESIGN.md`, and show Patric the finished candidates side by side on staging
   with one question: "a, b or c?". He picks by looking; he never directs the design.

**Self-check** (light and full): against `DESIGN.md`, no raw colour or size outside the tokens,
nothing from the anti-defaults list, both screenshots taken and compared with a neighbouring page.

**Done when** the screenshots exist and match the reference, the reviewer's last pass has no
findings above "taste", and for a new look Patric has picked a candidate.
