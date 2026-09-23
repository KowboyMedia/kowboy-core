# Porting a client's templates to v4: the environments and the workflow

Proposed 2026-09-21; Patric chose Cloudways the same day (question 78). It generalises step 2
([default-templates.md](default-templates.md)) from one client to any: Patric says "port all
Kowboy templates for site X to version 4", and an agent does the rest, assuming that version 4's
helper functions and universal fields may be missing or wrong, and raising what it finds. The
source site may run plugin version 1, 2 or 3, with or without a custom theme.

## What the agent can reach, checked 2026-09-21

Everything an agent does leaves its environment as web traffic over HTTPS, and nothing else: SSH
and SFTP (a host's shell and file-transfer access) are blocked on every port, and a tunnel through
the environment's web proxy carries no SSH either. So the agent never has a shell on any server.
What it has: the DigitalOcean API (Core's apps and the Space), GitHub, any site's WordPress admin
and REST API over HTTPS, and a host's API where the host has one. A person keeps SFTP and a shell;
the agent does not need them, provided the host has an API and each site has a WordPress admin
login.

## Where the environments run: the options

| Option                                            | What the agent can do there                                                                                                                                                                       | Copies of client sites                                                       | Cost                                                                                                           | Verdict                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| A. One Cloudways server in Kowboy's account       | everything, through the Cloudways API: make an app, copy an app from any Cloudways server, read its admin and SFTP logins, set its cron, password-protect it, back it up, and the WordPress admin | one API call for every client that lives on Cloudways, which is most of them | about $11 a month for the smallest 2 GB server (Cloudways' pricing page, 2026-09-21), more as pairs accumulate | **recommended**                                            |
| B. One plain DigitalOcean server the agent builds | creation only: with no shell, every later operation needs a control layer the agent builds and maintains itself, a home-made hosting panel                                                        | none: every client needs an export made by a person                          | about $12 a month                                                                                              | no: it builds what Cloudways already is                    |
| C. App Platform, one app per site                 | everything through the API, but no persistent files and a managed database per site                                                                                                               | none                                                                         | about $20 a month per site                                                                                     | no                                                         |
| D. Inside the agent's session, from an export     | everything, but gone when the session ends, and nothing for Patric to look at                                                                                                                     | from exports only                                                            | nothing                                                                                                        | later, as a faster inner loop if the compare runs get slow |

Cloudways, because it is the only option where an agent with web access alone controls the
whole server through an existing, market-leading API, and because most client sites already
live there, so a copy of a client's site is one API call and no person's afternoon. A person
gets SFTP and a WordPress login for every app from the same panel; the agent uses the API and
the WordPress admin. The DigitalOcean API stays what it is today, Core's.

## The environments: a pair per client

- **The source**: a copy of the client's live site, old plugin and all, taken by the Cloudways
  API onto the porting server. For a client elsewhere: an export made with a migration plugin,
  one step by a person, or the live site's admin login so the agent makes the export itself.
  The copy is password-protected, keeps search engines out, sends no mail, and its old plugin
  runs untouched as a black box: its files are never opened (AGENTS.md), and its polling of the
  CRM is switched off in its own settings where it has such a switch.
- **The target**: a second copy of the same site, with the old plugin replaced by Core's plugin
  and the client's template set, synced from staging Core's tenant for that client (the client's
  CRM login is added on the tenant page). Same pages, same content, same theme, so every public
  address exists on both. The target is also step 1's test site for that client
  ([staging-site.md](staging-site.md)).
- **Addresses**: the host's own (`….cloudwaysapps.com`), or a kowboy.se name with one DNS entry.
- A pair stays as long as Patric wants it; a target can stay on as the client's demo of version 4.

## The workflow, from "port site X"

What the agent needs in hand: the client's name; the client's CRM login, if staging does not
hold it yet; for a client not on Cloudways, an export or the live site's admin login; and the
theme's repository, when the port should be delivered into it.

1. **Environments.** Source and target as above, unattended, within the hour.
2. **Inventory.** From the source's pages (its sitemap lists every public page) and the theme's
   template files (read on the copy through the admin's theme file editor, or from the theme's
   repository): every template, shortcode, attribute and value the site uses. The old plugin's
   own files: never. The inventory is the parity list of AC 28 for that client.
3. **The port.** The client's template set (`core-client-templates-<client>`, or the theme's
   override folder when the client keeps a custom theme), file by file: the old helper calls
   become version 4's functions, the old field names become universal names and display keys,
   and the layout stays. The client's pages call the old shortcode names, so the client's set
   answers to those names and no page is rewritten; when a name collides with version 4's own,
   the agent rewrites the pages instead and says so.
4. **Compare.** For every public address, the source's and the target's pages are fetched, what
   cannot match is normalised (whitespace, nonces, asset addresses, the host, image widths,
   timestamps), the templates' own regions are compared, and so are the list wrappers' reload
   answers for the same filters. The loop runs until every diff is empty or raised.
5. **Gaps**, by the rule of step 2. A value the site shows whose prepared string `display` lacks,
   or a field that exists nowhere in `data`, or a filter the query function cannot answer: a
   register question, raised in one batch (protected paths). A helper or a field that exists in
   version 4 but is wrong: a bug, fixed with a test, no question. A helper the plugin lacks:
   added. A value shown as sent: listed in the inventory.
6. **Delivery.** The set released on its own channel and installed on the target, a report with
   the diff per page, the register batch, and Patric's look at the target next to the source.

Steps 1, 2, 4 and 6 are the same for every client; steps 3 and 5 are the work. With Cloudways,
nothing in the list needs a person except the CRM login the first time a client's account
reaches staging.

## The server and the pairs, as made

Nothing yet (2026-09-21). Every agent that makes something here writes it down in this section:
the server's name, id and address; per client the two apps' names, ids and addresses, where their
logins live (the Cloudways API, never here), the tenant on staging Core, and the date. Secrets
never.

## What it needs from Patric

- **79** a Cloudways API key in the agents' environment settings, as `CLOUDWAYS_EMAIL` and
  `CLOUDWAYS_API_KEY`.
- **80** the first client to port, by the name Cloudways lists it, and its CRM login if staging
  does not hold that account.
- Per later client: the same two things.
