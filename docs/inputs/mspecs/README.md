# Mspecs documentation

Fetched from https://integration.mspecs.se on 2026-10-04 (the forms strategy, `docs/forms.md`,
question 132). Vendor documentation, saved as fetched, never edited by hand. This is the spec of
record for the Mspecs adapter until Mspecs sends more.

| File                                                                     | What                                                                                                                                                                                                                                                                                                                                                            | Source                                                                                                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [marketing-provider.openapi.json](marketing-provider.openapi.json)       | "MSPECS integration documentation" version 2.1.0: the OpenAPI specification of the API a service provider (a website builder such as Kowboy) uses towards Mspecs, with the endpoints Mspecs calls on the provider (the publish events) described in the same document. Basic authentication with a provider account; production `integration.mspecs.se`, test `test-integration.mspecs.se`. | `https://integration.mspecs.se/swagger.json` (the page `https://integration.mspecs.se/` renders it)                        |

Refresh with:

```bash
curl -fsSL https://integration.mspecs.se/swagger.json -o docs/inputs/mspecs/marketing-provider.openapi.json
```

What it holds, for orientation (the specification is the truth):

- **The model.** Kowboy is a *marketing provider* with one provider account. A brokerage
  (*subscriber*, an organization with offices) adds the provider's service inside Mspecs; Mspecs
  then sends publish events for the deals (homes) it publishes to the provider, and a
  `subscriber-id` names the brokerage on every call the provider makes. One account for every
  brokerage, like Vitec's partner key pair.
- **Reads.** Published deals, sold deals, a deal by id, a project's deals, website settings, the
  brokerage's offices and users.
- **Writes a website can make** (the forms): add a prospective buyer to a deal
  (`POST /api/marketing/deals/{dealId}/prospectiveBuyer`), add a buyer to a viewing
  (`…/externalViewer/{viewingId}`) or to a viewing slot (`…/slot/{slotId}`), and add a lead with
  matching criteria (`POST /api/marketing/leads/matching`: rooms, price, living area,
  municipalities, object type, an area polygon), which becomes a contact with a search profile.
- **Viewings** come with the published deal: by comment only, by date, by date and time, or with
  slots (`slotCapacity`, `slotLength`, `slots[]` with `id`, `startTime`, `freeSpots`), each with
  `allowExternalBooking`.

Not in this document: a valuation request without a home (a lead needs at least one matching),
the demo system's older "MSPX API" at `demo.mspecs.se/doc/` (table-level access for a
brokerage's own API user, not for a website builder), and anything Mspecs sends only on request.
