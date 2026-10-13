# DESIGN.md - the admin area

How Core's admin area looks and which parts it is built from. It covers the new admin area that
replaces the current one (`docs/next-steps.md` item 30); the WordPress templates get their own
part here once one is derived. It comes from Patric's pick of Tabler on 2026-10-13 ("Tabler looks
good. Use that.") and from his complaint of the same day: "a list in one place had different
layout and values compared to the same type of list, listing the identical data types in another
place". What the area holds is `docs/admin-panel-rebuild.md` §1, §3 and §8, cut to the MVP that
question 191 settles. This file changes only on Patric's word, through a register question.

## Tone

Four words: **plain**, the reader's own words and nothing they would have to ask about; **exact**,
names, counts and times rather than adjectives; **calm**, colour only where something needs a
person; **quiet**, a page shows what it is for and nothing else.

## Tabler, as it ships

- The stylesheet and script of `@tabler/core` (1.6.1), imported once in the app's entry file, as
  Tabler's React guide says (https://docs.tabler.io/ui/getting-started/frameworks/react, read
  2026-10-13). Tabler's script contains Bootstrap's, so no Bootstrap package is loaded beside it,
  as Tabler's installation page warns.
- A page is Tabler's documented markup and classes. There is no stylesheet of our own for colours,
  sizes, spacing or shadows. A rule Tabler has no class for (Flow's row that lights up) is the one
  exception, and it carries a comment saying why.
- Icons are Tabler Icons (`@tabler/icons-react`), in the outline style, in the menu and in empty
  states only. A button carries words, never an icon or an arrow.
- The light theme only; dark mode is rated a Could.

## Colour

Six colours, all Tabler's own, each with one meaning and no other.

| Colour | Tabler's name | It means                                                                              |
| ------ | ------------- | ------------------------------------------------------------------------------------- |
| Blue   | `primary`     | A link, the current menu entry, the main button of a page.                            |
| Green  | `green`       | It works or it arrived: a live record, a record a site applied, a tenant switched on. |
| Azure  | `azure`       | On its way: a record fetched from the CRM that no site has applied yet.               |
| Yellow | `yellow`      | Worth a look: a problem at level P2.                                                  |
| Red    | `red`         | Broken, or lost when pressed: an error, a problem at P0 or P1, a dangerous button.    |
| Grey   | `secondary`   | Waiting, gone or off: waiting for the CRM, a removed record, a tenant switched off.   |

The page's background and the white cards are Tabler's surfaces. No other colour appears.

## Type, spacing and shape

- Tabler's system font stack (`system-ui` and the platform's own font), so no web font is loaded.
- Tabler's sizes only: a page title 20 px, a card title 16 px, body text 14 px, secondary text
  12 px. Tabler's monospace only for a CRM's raw payload and for a value to copy (a token, a bell
  secret, an address).
- Every date, time and number in Swedish form: `2026-10-13 15:42`, `12 345`, in Stockholm time,
  with the exact UTC moment in the time's tooltip as extra information.
- Tabler's spacing steps (4, 8, 16, 24 and 48 px, through its classes), its radius (6 px, 8 px
  on a card) and its card shadow. No pixel value of our own.

## The frame of every page

- **The top bar**: "Kowboy Core" on the left; on the right, the signed-in address and Sign out.
- **The menu bar** under it, Tabler's horizontal layout as in the reference: the pages of the MVP
  in the order a person works, the Overview first and Settings last, each with its icon. A CRM's
  page is one entry named by the CRM itself. On a phone the menu folds behind Tabler's menu
  button.
- **The page header**: the page's title, one line saying what the page is for, and on the right
  the page's main button, at most one.
- **The page body**: Tabler's `container-xl`, its cards one under the other. A card holds things
  that belong together, never a heading and a paragraph alone.
- **On a phone**: one column, and a list scrolls sideways inside its own card, so the page never
  does.

## How much text

Every text a person reads follows AGENTS.md's definition of done 4 and 5 and the handbook's rule
for texts. This section says how much of it a page holds.

- One line under a page's title.
- One sentence beside each button saying what pressing it does and when to press it: beside it
  on a computer, under it on a phone, never only on hover.
- A line of help under a field only when its label cannot say what to type.
- Nothing else: no paragraphs, no cards of notes, nothing said twice on one page.

The words for things are tenant, connection (a tenant's CRM connection, which has no page of its
own), site, office, record and the entity types property, project, agent, office, area and
association, never "home". The area is in English.

In a sentence, a tenant is named by its name; a connection by its tenant and CRM, then its name
("Acme's Vitec connection “Main”"); a site by its address and its tenant; an office by its name,
then the CRM's id for it ("the office Lidingö, the CRM's id M30011"); a record by its address or
name. In a list, a thing is its cell (below). Nothing shows Core's own id for anything, a type,
an event's or a check's name, a register number, a person, the date of a decision or a document.

## One part for each kind of thing

A kind of thing is drawn by one part, and every page that shows that kind of thing uses that part.
No page draws a tenant, a record, an office, a time or a state by itself.

| Part      | What it draws                                                                                                          | Where                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `Thing`   | A tenant, connection, site, office, record or CRM by its name or its cell, linked to its place.                        | Everywhere a thing is named.                |
| `Time`    | A moment in Swedish form, with the UTC moment in its tooltip.                                                          | Every list and every page.                  |
| `State`   | A state as one word and its colour, from the table of states below.                                                    | Lists and page headers.                     |
| `List`    | A card with a table: the columns of its kind, sorted by the first; Back and Next; its empty, loading and error states. | Every list.                                 |
| `Scope`   | Tenants, offices, entity types and one record id, kept in the page's address so a link opens the same view.            | Records, Flow and Manual sync.              |
| `Figure`  | A number, what it counts, and a link to the list of what it counts.                                                    | The Overview and a tenant's page.           |
| `Details` | Labels and their values in a grid (Tabler's datagrid).                                                                 | A record's facts, a CRM's values, Settings. |
| `Form`    | Labelled fields in one card, a mistake under its field as it is typed, one Save at the end.                            | A tenant's page, sign-in.                   |
| `Action`  | A button and its sentence. A red one asks first.                                                                       | Every button.                               |
| `Confirm` | A window saying what will happen, with Cancel and a red button named for the act.                                      | Every red button.                           |
| `Toast`   | A message for every outcome: green when it is done, red when it is not, and then what to do.                           | Every save and every action.                |
| `Empty`   | What is missing and what to do, with the button or link that does it.                                                  | Every list or page that can be empty.       |
| `Copy`    | A value in monospace with a Copy button that says "Copied".                                                            | The token, a bell secret, an address.       |
| `Payload` | A CRM's raw payload, laid out, scrolling inside its card.                                                              | A record's page.                            |

## Lists: the same thing, the same cell, the same column

1. A list is sorted by its first column, newest first when it is a time and A to Z when it is a
   name, and in no other way. No reader sorts, hides or adds a column.
2. A thing is the same cell in every list, linked to its place. A record is the CRM's id, with its
   entity type and its address or name on a second line. An office is the CRM's id for it. A
   tenant is its name, a site its address, and a connection its name with its CRM on a second
   line.
3. Columns that two lists share stand in the same order: Record, Tenant, Office, State.
4. A list that holds more than one page has Back and Next under it.
5. Each kind of list has these columns and no others:

| List                                   | Its columns, in order                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| Records                                | Changed · Record · Tenant · Office · State                                             |
| Flow, also when it shows a manual sync | Queued at · Record · Tenant · Office · State · What happened · Attempt · Site's report |
| Events, also as a record's timeline    | Time · What happened                                                                   |
| Needs attention                        | Since · Level · Problem · Where                                                        |
| Tenants                                | Tenant · State · Connections · Sites                                                   |
| Devices                                | Device · Signed in · Last used                                                         |
| A table a CRM's code declares          | As the CRM's code declares them, each thing in it drawn by `Thing`                     |

## States: one word and one colour each

| Kind of thing      | Word, and its colour                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| A record           | Live (green), Removed (grey).                                                                                           |
| A record in flight | Waiting (grey), Fetched (azure), Applied (green), Error (red); in Flow the whole row takes the colour, lightly.         |
| A tenant           | On (green), Off (grey).                                                                                                 |
| A problem's level  | The words Core's alerts use: P0 Core down (red), P1 Disrupted (red), P2 To look at (yellow), P3 For information (grey). |
| Core as a whole    | One line on the Overview: green when nothing needs a person, otherwise the colour of the worst level.                   |

A colour never stands alone: its word is always beside it.

## Danger

- Red, and asking first, only where something is lost or stops working when pressed: a new token
  (the one the sites hold stops working), a new bell secret, removing a connection (its records
  leave the sites), removing a site (its history goes with it).
- What can be done again without loss (fetching again, recomputing, sending to the sites) is a
  plain button whose sentence says why it costs nothing.
- The confirmation's title asks the question ("Make a new token for Acme Mäklare?"), its text says
  what stops working and what to do next, and its red button repeats the verb ("Make a new
  token").

## Motion

Only Flow moves: a row that arrives or changes state lights up for a moment. Nothing else
animates.

## Never

- A stack of cards that each hold a heading and a paragraph.
- A small capital label above a title (Tabler's page pretitle).
- A green card saying that something is fine, or a list of what needs no attention.
- A text that explains only on hover, a paragraph, or the same explanation twice on one page.
- A columns button, a rows-a-page box, a sortable header, ticked rows.
- One kind of thing drawn two ways, or a list's columns in another order than the table above.
- An id where a name exists. The CRM's id of a record and of an office are the exceptions: a
  person finds them in the CRM by it.
- "Home" as an entity type.
- Red for something that loses nothing.
- An icon or an arrow on a button, a section that fades in, a second main button on a page.
- A colour, size or shadow of our own.

## References

1. Patric's screenshot of Tabler's demo dashboard, `docs/inputs/admin-tabler-reference.png`
   (2026-10-13): the frame, the cards and the figures.
2. Tabler's demo, https://preview.tabler.io/ : every part as it ships.
3. Tabler's documentation, https://docs.tabler.io/ (version 1.6.1, read 2026-10-13): the markup
   each part uses, and its React guide for how the app uses Tabler.
