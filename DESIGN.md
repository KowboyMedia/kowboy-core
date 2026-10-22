# DESIGN.md - the admin area

How Core's admin area looks and which parts it is built from. It covers the new admin area that
replaces the current one (`docs/next-steps.md` item 30); the WordPress templates get their own
part here once one is derived. It comes from Patric's pick of Tabler on 2026-10-13 ("Tabler looks
good. Use that."), from his complaint of the same day ("a list in one place had different layout
and values compared to the same type of list, listing the identical data types in another
place") and from his basis for what the area holds: what an admin sets up for Core to run, and
what that needs ("MVP Greenfield"). Every page and window is drawn in the images in
`/mnt/project-files/admin-new/` and listed row by row in question 192. This file
changes only on Patric's word, through a register question.

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
  sizes, spacing or shadows.
- No icons: a button carries words, and nothing else on a page needs a picture.
- The light theme only.

## Colour

Four colours, all Tabler's own, each with one meaning and no other.

| Colour | Tabler's name | It means                                                                          |
| ------ | ------------- | --------------------------------------------------------------------------------- |
| Blue   | `primary`     | A link, and the main button of a page.                                            |
| Green  | `green`       | It works: a tenant, connection or site that works, an office Core reads.          |
| Red    | `red`         | Broken, or lost when pressed: a problem, an office the CRM refuses, a red button. |
| Grey   | `secondary`   | Waiting, or not set up yet.                                                       |

The page's background and the white cards are Tabler's surfaces. No other colour appears.

## Type, spacing and shape

- Tabler's system font stack (`system-ui` and the platform's own font), so no web font is loaded.
- Tabler's sizes only: a page title 20 px, a card title 16 px, body text 14 px, secondary text
  12 px. Tabler's monospace only for a value to copy or a part of an address a person types:
  Core's address, the token, a bell secret, a bell path, the CRM's notification address.
- Every date, time and number in Swedish form: `2026-10-13 15:42`, `12 345`, in Stockholm time,
  with the exact UTC moment in the time's tooltip as extra information.
- Tabler's spacing steps (4, 8, 16, 24 and 48 px, through its classes), its radius (6 px, 8 px
  on a card) and its card shadow. No pixel value of our own.

## The frame of every page

- **The top bar**: "Kowboy Core" on the left, linking to the tenants list; on the right, the
  signed-in address and Sign out. There is no menu: the area has two kinds of page, the tenants
  list and a tenant's page.
- **The page header**: on a tenant's page, "Tenants / its name" above the title; the title; under
  it the tenant's state and one sentence saying whether every change reaches the sites; on the
  right one button with its sentence ("New tenant" on Tenants, "Rename" on a tenant's page).
- **The records' way**: a tenant's page is Tabler's `container-xl` with two cards side by side,
  the CRM connection on the left ("From Vitec “Main”") and the sites on the right ("To 2 sites"),
  with an arrow between them. A page shows what is set as text and holds no field.
- **Windows**: every change is made in a window that its button opens: New tenant, Rename,
  Connect Vitec, Change, Add a site, a site's window. A window saves on its own; nothing saves a
  whole page.
- **The banner**: while Core itself has a problem, a red banner above the page header on every
  page; nothing while Core works.
- **On a phone**: one column, each button's sentence above it, the arrow pointing down, and a
  list scrolls sideways inside its own card, so the page never does.

## How much text

Every text a person reads follows AGENTS.md's definition of done 4 and 5 and the handbook's rule
for texts. This section says how much of it a page holds.

- One line under a page's title.
- One sentence beside each button saying what pressing it does and when to press it: beside it
  on a computer, above it on a phone, never only on hover.
- A line of help under a field only when its label cannot say what to type or where to find it.
- A problem's sentence where the thing is: under the office, the site or the field.
- Nothing else: no paragraphs, no cards of notes, nothing said twice on one page.

The words for things are tenant, connection (a tenant's CRM connection, which has no page of its
own), site, office, record and the entity types property, project, agent, office, area and
association, never "home". The area is in English.

In a sentence, a tenant is named by its name; a connection by its tenant and CRM, then its name
("Exempel Mäklare's Vitec connection “Main”"); a site by its address ("the site exempel.se"); an office by its
name, then the CRM's id for it ("the office Lidingö, the CRM's id M30011"). In a list, a thing is
its cell (below). Nothing shows Core's own id for anything, a type, an event's or a check's name,
a register number, a person, the date of a decision or a document.

## One part for each kind of thing

A kind of thing is drawn by one part, and every page that shows that kind of thing uses that part.
No page draws a tenant, a site, an office, a time or a state by itself.

| Part      | What it draws                                                                                  | Where                                                       |
| --------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Thing`   | A tenant, connection, site or office by its name or its cell, linked to its place.             | Everywhere a thing is named.                                |
| `Time`    | A moment in Swedish form, with the UTC moment in its tooltip.                                  | Beside every state, in the banner.                          |
| `State`   | A state as one word and its colour, from the table of states below, with a problem's sentence. | Lists, a connection's card, a site's block.                 |
| `List`    | A card with a table: the columns of its kind in their order; its empty and error states.       | The tenants list, a connection's offices, a tenant's sites. |
| `Way`     | The records' way: the connection's card, an arrow, the sites' card.                            | A tenant's page.                                            |
| `Facts`   | What is set, as label and value on one line.                                                   | A connection's card.                                        |
| `Form`    | Labelled fields, a mistake under its field.                                                    | Every window, sign-in.                                      |
| `Window`  | A title, its fields or values, its buttons with their sentence; it saves on its own.           | Every change: New tenant, Rename, Connect, Change, a site.  |
| `Action`  | A button and its sentence. A red one asks first.                                               | Every button.                                               |
| `Confirm` | A window saying what stops working, with Cancel and a red button named for the act.            | Every red button.                                           |
| `Toast`   | A message for every outcome: green when it is done, red when it is not, and then what to do.   | Every save and every button.                                |
| `Copy`    | A value in monospace with a Copy button that says "Copied".                                    | A site's window, the CRM's address in Connect and Change.   |
| `Banner`  | Core's own problem: what it means for the sites and where to look.                             | Every page, while it lasts.                                 |
| `Empty`   | What is missing and what to do, with its button.                                               | The tenants list without tenants, a tenant not set up.      |

## Lists: the same thing, the same cell, the same column

1. A thing is the same cell in every list, linked to its place: a tenant its name; a connection
   its name with its CRM on a second line; a site its address; an office the CRM's id for it with
   its name on a second line.
2. No reader sorts, hides or adds a column.
3. Each list has these columns and no others:

| List                   | Its columns, in order                   | Its order                                  |
| ---------------------- | --------------------------------------- | ------------------------------------------ |
| Tenants                | Tenant · State · CRM connection · Sites | Tenants with a problem first, then A to Z. |
| A connection's offices | Office · State                          | By the CRM's id.                           |
| A tenant's sites       | Site · State                            | By address.                                |

## States: one word and one colour each

| Kind of thing | Word, and its colour                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A tenant      | Works (green); Problem (red), with its first problem's sentence; Not set up (grey), with what is missing.                          |
| A connection  | Works (green); Problem (red); Waiting (grey) before its first fetch. Beside it, when its last change was fetched.                  |
| An office     | Reads (green); Refused (red), with what happens next and what to do.                                                               |
| A site        | Works (green); Problem (red), with what it means and what to do; Waiting (grey) before its first fetch. Beside it, its last fetch. |
| Core          | Nothing while it works; the banner while it has a problem.                                                                         |

A colour never stands alone: its word is always beside it.

## Danger

- Red, and asking first, only where something stops working or is lost when pressed: a new token
  (the one the sites hold stops working), removing a connection (its records
  leave the sites), removing a site.
- What can be done again without loss (fetching everything again) is a plain button whose
  sentence says nothing is lost.
- The confirmation's title asks the question ("Make a new token for Exempel Mäklare?"), its text says
  what stops working and what to do next, and its red button repeats the verb ("Make a new
  token").

## Motion

Nothing moves apart from Tabler's own opening of a window.

## Never

- A field on a page, or a Save for a whole page: fields live in windows.
- A stack of cards that each hold a heading and a paragraph.
- A small capital label above a title (Tabler's page pretitle).
- A green card saying that something is fine, or a list of what needs no attention.
- A text that explains only on hover, a paragraph, or the same explanation twice on one page.
- A columns button, a rows-a-page box, a sortable header, ticked rows.
- One kind of thing drawn two ways, or a list's columns in another order than the table above.
- An id where a name exists. The CRM's id of an office is the exception: a person finds the office
  in the CRM by it.
- "Home" as an entity type.
- Red for something that loses nothing.
- An icon or an arrow on a button, a section that fades in, a second main button on a page.
- A colour, size or shadow of our own.

## References

1. Patric's screenshot of Tabler's demo dashboard, `docs/inputs/admin-tabler-reference.png`
   (2026-10-13): the look of the frame and the cards.
2. The images in `/mnt/project-files/admin-new/` (2026-10-13): every page and window of the MVP
   with made-up content, drawn with Tabler's own stylesheet.
3. Tabler's demo, https://preview.tabler.io/ : every part as it ships.
4. Tabler's documentation, https://docs.tabler.io/ (version 1.6.1, read 2026-10-13): the markup
   each part uses, and its React guide for how the app uses Tabler.
