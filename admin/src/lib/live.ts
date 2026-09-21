// Pages built on one call rather than a list (the Overview, a tenant, a CRM, the Settings) still
// have to follow along without a reload (§3 I, Should). They subscribe to the same stream Refine's
// live mode uses for the lists, and simply ask their query again when something they show changes.
import { useSubscription } from '@refinedev/core';

export function useLive(resource: string, again: () => unknown): void {
  useSubscription({
    channel: `resources/${resource}`,
    types: ['*'],
    onLiveEvent: () => {
      void again();
    },
  });
}
