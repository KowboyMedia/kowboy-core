# AGENTS-shared.md - how agents work at Kowboy

The rules that are the same in every Kowboy repository. Read this before the project's own
`AGENTS.md`, which holds what is true only there; where the two differ, the project's file wins.
This file is protected: changes need Patric's approval, and they are made in the shared source and
copied to every repository, never edited in one repository alone.

## Who decides

Patric is the strategist and product owner. His only interface is the chat: he decides product
questions, and agents do all the work, git, infrastructure and configuration included. Agents
find problems and raise them; Patric decides; agents act on the decision. These rules exist because
sessions kept handing him instructions instead of results.

## Working with Patric

- **Do it yourself first.** Never ask Patric to edit a file, run a command, open a console or
  click through GitHub or a hosting panel. When a tool or a permission blocks you, say what
  blocked you in one line and ask him how to unblock it, not to do the work. When only a human
  can do a step (an authorisation, a payment), do everything around it and describe that one step
  in plain words.
- **Cost him the least.** Rate every option by Patric's time and effort and pick the cheapest for
  him. Only a real trade-off justifies another choice, and then each side gets one sentence.
- **Changes he asks for are ours end to end.** A rename, a move, a new branch or app: the agent
  makes every update that follows. "Let me know and I'll make all updates", never "then update
  the config files".
- **Write for the product owner.** Plain words, short, what it means for the product. No git,
  infrastructure or configuration vocabulary unless he asked for it. Patric does not work with
  git and does not know its words: to him never "branch", "merge", "commit", "push", "pull
  request", "rebase" or "conflict"; say "saved", "combined with the other session's work", "in
  staging" or "live" (Patric, 2026-09-19). Another person chatting with an agent may get the
  technical words.
- **Complete sentences, every term explained** (Patric, 2026-09-20; a rule, not a preference).
  In chat and in documents alike: full sentences, every term explained the first time it is used
  (a site, a pull, a bell, a connection), and never prose compressed by dropping words. Short is
  good; cut, not condensed, is not. The reasoning behind a gap or a question is written in full,
  in the register or the document, where chat can point to it.
- **Tooling is the agent's call.** Which tool, which plugin, where a test runs, how something is
  built: never asked. The agent decides, writes the decision down and moves on (Patric,
  2026-09-20, after a round of questions written with their reasoning and options was unreadable).

## Reply protocol

Every reply to Patric is four labelled blocks, in this order, and nothing outside them (Patric,
2026-09-20 and 2026-09-21: a page of prose per reply had to be searched for the questions; and an
answer never ends without saying what he does next). He reads the first block and answers; the
rest is optional reading.

1. **Questions.** One line per ask, numbered with the register's number, or the word "none".
   - **Two kinds of ask: Decide and Default** (Patric, 2026-09-27). A gate (the stop-and-ask lists:
     contract, money, something irreversible) is a _Decide_: it waits for his word. Everything else
     is a _Default_: the agent names its pick, does it, and Patric answers only if he disagrees; his
     silence is the answer. Each line starts with the word: "Decide 91: ..." or "Default 90: ...".
   - **Each answer in one clause of consequence.** A question names what happens on each answer,
     one clause each, nothing more: "91: a → I set it up, you create one empty repository; c →
     nothing to set up, copies drift apart."
   - **At most five per reply**, ordered by what blocks the most; the rest wait in the register
     until these are answered (Patric, 2026-09-27; a round of twenty was unreadable).
   - **Show before asking.** A question about anything visible carries the place to see it: a
     staging page, two links side by side, a screenshot. Patric judges by looking, not by reading a
     description.
   - **The number is the register's** (`docs/open-questions.md`): a question gets the next number
     there before it is asked, chat refers to that number, and Patric answers by number in any
     conversation. Never a fresh "1."; numbers keep counting across sessions and are never reused.
   - **Every ask is a real question or a real instruction** (Patric, 2026-09-23: two asks read as
     statements of state and he could not tell what to do). A question ends with a question mark
     and names its answers, with the smaller option named: "Is norbanmakleri.se the master? Answer
     yes or no." An instruction starts with the verb of the one step and says when it is done:
     "Save the new token in the environment's settings, then say 'saved'." A line that only
     describes a situation, or tells Patric what the agent assumed, is not an ask: it goes in
     Notes, and if an answer is needed, a question follows it.
   - **One line per ask, the reasoning in the register.** Chat gets what is needed and how to
     answer it (a paste, a yes or no, or a pick between two things named in plain words). The
     register entry carries the whole reasoning in complete sentences, and chat gives it when
     Patric asks.
2. **Done.** One line per thing that changed, each saying how it was verified ("seen on staging",
   "tests green", "not yet run against real Vitec") and, where it changed something people use,
   how to take it back ("undo: say 'undo 12'"); the agent keeps the means to undo (Patric,
   2026-09-27).
3. **Notes.** Only when something matters for a decision, one line each; otherwise omitted.
4. **Next.** One or two plain lines: what Patric does next. "Nothing, I carry on", "answer 74 with
   yes or no", or the one step only he can take, named. An agent never leaves the conversation, or
   pauses to wait, without them.

## The project's memory

Every project keeps four files under `docs/`. They are how a decision made in one conversation
reaches every later one, and they are kept current in the same change as the work.

| File                     | Holds                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/open-questions.md` | The register: every question asked of Patric, numbered for good, tagged with its part, naming what is blocked and the smaller option. Its header says the next number. An answered question gets its line in `decisions.md` and leaves.                                                                                                                      |
| `docs/decisions.md`      | One line per structural decision: date, decision, reference. Append only; a changed decision is a new line that says what it supersedes, never an edit. A decision made under a constraint names it ("no Sentry, because Core is one instance · revisit if a second instance appears"), and the agent raises the decision again when the constraint changes. |
| `docs/next-steps.md`     | The order of work, opening with "Where to pick up". "Resume next steps" means: read it, do the first item that is not done, keep it current.                                                                                                                                                                                                                 |
| `docs/known-bugs.md`     | What is wrong and known, numbered for good: what happens, why, what fixing it takes. Not a question: nobody has to decide anything, someone has to do it.                                                                                                                                                                                                    |

A project that lacks any of them gets it from the shared template the first time it is needed.

## Raising issues

- Raise an issue when you find it, not at the end. Do not sit on it and do not resolve it yourself.
- Raise it as a **numbered list whose numbers are the register's**. Each item: the issue in one or
  two sentences, an optional suggested solution, and whether it needs approval.
- **Tag every item with the part it concerns**, in brackets first. The project's `AGENTS.md` lists
  its tags.
- Once an item is approved, act on it. That includes updating the project's plan: agents may
  change strategy documents when the change is approved, and note it in `docs/decisions.md`.

## Twice is a rule

The second time Patric corrects the same thing, the agent writes the rule in the same reply, with
the date and the correction that caused it, and says where it now lives: `AGENTS-shared.md` if it
holds everywhere, the project's `AGENTS.md` if it holds only there (Patric, 2026-09-27; the slug
rule took six repeats and the reply format three). A rule nobody would break without it is deleted
the same way.

## Stop and ask

Stop and ask the person who gave you the task, and don't improvise, when a task needs any of these
(the project's `AGENTS.md` adds its own):

- a new runtime dependency, vendor or recurring cost
- a library or framework added, dropped or swapped, or a departure from a proposal Patric approved
  (Patric, 2026-09-20): pause, propose with the net value, and wait
- a decision the project's plan doesn't settle. Pick the smaller option; if both still look
  reasonable, ask.
- action on a production incident

**A closed gate is not a note.** When something on this list is needed and nobody is there to
answer, build only what does not depend on it, leave the gap visibly empty, and put the question
in `docs/open-questions.md`. Never fill a gap provisionally: a placeholder that looks real gets
built on and believed.

## Session

- **Start** by reading "Where to pick up" in `docs/next-steps.md` and the open questions; the
  session-start hook prints both. Start from the converged state (staging) unless told otherwise.
  The hook also checks that the credentials and services the project needs answer; a refused
  token or an unreachable service is reported in the first reply, never discovered mid-task.
- **"Status"**, said in any session, returns the four memory files in the four blocks: what waits on
  Patric, what is in staging but not live, the known bugs, and what remains; nothing else.
- **Finish** every piece of work with the memory current: `docs/next-steps.md` says what remains,
  `docs/decisions.md` has a line for any structural choice, and every question asked is in the
  register. Then save the work and report in the reply protocol.
- **Sessions running side by side** each save their own work and are combined into staging. Two
  sessions can take the same register number; when that happens, both meanings stand and the
  register counts on (Patric, 2026-09-23). The register check reports duplicates at combine time.

## Units of work

- **One item per session.** A session takes one item of `docs/next-steps.md`, marks it "in
  progress" there with the date, and ends with the item done or handed back with what was learned.
  Two sessions never work the same item; a new session takes the first unmarked one.
- **Plan before building** when a change touches more than a few files, a protected path or the
  contract: the plan goes into the item in `docs/next-steps.md` first (what changes, what is
  tested, what is a Decide), and code starts after it. A change that fits in one sentence skips
  the plan.
- **Two failed fixes end the attempt.** When the same problem has survived two fixes, stop, write
  what was tried and learned into the item, and hand it to a fresh session; a clean start beats a
  long session of corrections.
- **A flaky test is a bug the day it is seen.** A test that fails and then passes without a change
  gets a number in `docs/known-bugs.md` and is fixed or held out with that number; it is never
  re-run into green, and never deleted.

## Principles and code

- **Simple beats clever.** When two designs work, the one with less code wins. Nothing is built
  for a need that doesn't exist yet.
- **Market-leading solutions and patterns first** (Patric, 2026-09-20; a production strategy, not a
  preference). For anything a widely used library, framework or established pattern already does
  well, use it rather than build it; reinventing is the exception and needs a stated reason.
  Adding, dropping or swapping a library or framework is a proposal that names the net value and
  waits for his answer; never a silent choice.
- **One code path per concern.** The same logic never exists twice. Search for the existing
  function before writing a new one. No options or flags for cases that don't exist yet.
- **Readable code.** A reader should understand an endpoint or job from a few files. No home-made
  layers (dependency-injection containers, generic repositories, wrappers around libraries) where
  a market-leading library or framework does the job; a framework is used the way its
  documentation says.
- **Delete rather than comment out.**
- **Tests are the acceptance.** If something can't be tested automatically, raise it as a design
  problem. Never add a manual step. Never make a test pass by editing its expected output.
- **Never invent a business rule or a contract field.** A rule or field nobody wrote down is a
  question.

## Checks

- **Few hard blocks.** The project's `AGENTS.md` lists the checks that block merge or deploy; they
  are the only ones, and adding one needs approval. Everything else is a warning: reported, never
  blocking.
- **Leave every file you touch free of warnings.**

## Definition of done

1. The enforced checks are green, and the files you touched have no warnings.
2. **A fresh pair of eyes before Patric's.** Before anything he can see is reported done, a second
   agent with no memory of building it (a subagent) compares it with the acceptance criteria and
   the reference it must match, and only what passes reaches him; what fails is fixed or listed
   in Notes (Patric, 2026-09-27).
3. A `docs/decisions.md` line exists for any structural choice, and `docs/next-steps.md` is current.
4. The project's own definition of done, in its `AGENTS.md`, is met.
