# Clients

A client is templates plus a sync loop (Concept). It keeps a full local copy of one tenant's Core
data, renders only from that copy, and never names a CRM. Two clients exist, both built to the same
subscriber contract (SRS §8):

| Client                       | What it is                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------- |
| [wordpress/](wordpress/)     | A thin WordPress plugin, plus a must-use updater that keeps it current       |
| [lovable-kit/](lovable-kit/) | One Supabase edge function and two migrations every Lovable site starts from |

Today both hold exactly the sync loop: settings, a bell endpoint, the cursor-per-datatype pull with
the hash as the skip test, tombstones, `forcerefresh`, `resync_required`, one sync at a time, a 15
minute backstop, and a local store that keeps `data` verbatim. Templates, search, routing and the
index columns for filters wait for the data model (`docs/field-tables.md`): nothing here guesses at
a field.

## The sync scenario suite

[sync-scenarios.ts](sync-scenarios.ts) is one set of scenarios that every client must pass, run as
the **real client against the real Core** (AC 20). Each scenario starts Core in-process with the
fake polling adapter, starts the client as its own process, registers it as a subscriber, and then
drives the CRM stand-in: bells ring for real, cursors move for real, and the client's local copy is
read back to compare.

| Client      | Runs as                                                              | In                                          |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------- |
| Lovable kit | The function under Deno, against the test Postgres                   | `npm test`                                  |
| WordPress   | A real WordPress install served by PHP's built-in server, on MariaDB | `npm run test:wordpress` and its own CI job |

The WordPress suite needs a one-time setup on the machine that runs it:

```bash
# a MariaDB or MySQL database core_client_test that user core / password core can reach, then
bash clients/wordpress/test/setup.sh     # clones WordPress, writes wp-config, installs, links the plugin
npm run test:wordpress
```

`clients/wordpress/test/setup.sh` documents the variables (`WP_ROOT`, `WP_DB_*`).
