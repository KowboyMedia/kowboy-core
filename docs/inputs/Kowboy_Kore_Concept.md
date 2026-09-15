# Kowboy Kore - Concept

**One page. Read this before making any judgment call the SRS does not answer.**

## Why we are building it

Kowboy Media builds websites for Swedish real estate brokerages. The data on those sites (properties, agents, offices, areas, housing associations) comes from the brokerage's CRM, today Vitec or Mspecs.

That integration currently lives inside a WordPress plugin, one copy per site. It has grown over years into something over-engineered: hard to troubleshoot, risky to change, and a fix has to be shipped to every site separately. Every new product idea, a Lovable site, a React SDK, a dashboard, would mean rebuilding the same CRM logic again.

**Kore is one central service that talks to the CRMs and serves one normalized data model to any number of thin clients.** The WordPress plugin becomes a thin client. So does a Lovable site, and anything we build later.

## What we get from it

- **Patch once.** A mapping or formatting bug is fixed in Kore and reaches every site, with no client release and no CRM traffic.
- **Simple clients.** A client stores data locally and renders it. No CRM knowledge, no business rules, so it is small enough to be safely changed by an agent.
- **New products.** Cheap Lovable sites and a sellable CRM integration become possible because the hard part is already built and shared.
- **Sites stay up.** Clients render only from their own local copy. Kore being down means stale data, never a broken site.

## The rules that settle arguments

1. **Simple beats clever.** When two designs both work, the one with less code wins. 
2. **The seam.** Kore core knows nothing about any CRM and never names one. Adapters know nothing about how Kore stores data. Everything CRM-specific, including deciding when to fetch, lives in the adapter.
3. **All data logic in Kore.** Clients hold templates and a sync loop.
4. **Tests are the acceptance.** Every change is verified by fixture and contract tests, so an agent can build, deploy to staging and go to production without a manual check. If something cannot be tested automatically, that is a design problem.
5. **Anything derived must be patchable.** We can re-run rules over stored data without touching a CRM and re-deploy to clients. Nothing may depend on when a row was last written locally.

## What Kore does not do

It does not render, search, host images, or write back to a CRM. It does not know what a website looks like. Search and presentation belong to the client, against its own local copy.

## Scope

The first two clients are a thin WordPress plugin and a Lovable reference site. Both are built against the same subscriber contract, so a third client type later requires no change to Kore.

**If you hit a gap:** ask which side of the seam the concern belongs on, then pick the smaller option. If both answers still look reasonable, ask Patric rather than inventing structure.
