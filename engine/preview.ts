// A preview link (strategy §5.3, AC 42): the way an agent shows a seller an item that is not
// public yet. The link is a GET on the tenant's site's bell endpoint, with a token the site
// checks with its bell secret; the site pulls from Core before it shows the item, so the page is
// what Core holds at that moment. The engine only makes the link; a CRM's own preview flow is its
// adapter's, and the page is the site's.
import { createHmac } from 'node:crypto';
import { firstSubscriber } from './storage/connections.js';
import type { Datatype } from './adapter-api/types.js';

/** What a site checks before it shows an item that is not public: an HMAC of "datatype:id". */
export const previewToken = (bellSecret: string, datatype: Datatype, remoteId: string): string =>
  createHmac('sha256', bellSecret).update(`${datatype}:${remoteId}`).digest('hex');

/** The link for one item on the tenant's site, its first subscriber; null when there is none. */
export async function previewUrl(
  tenantId: string,
  datatype: Datatype,
  remoteId: string,
): Promise<string | null> {
  const subscriber = await firstSubscriber(tenantId);
  if (!subscriber) return null;
  const url = new URL(subscriber.bell_url);
  url.searchParams.set('datatype', datatype);
  url.searchParams.set('id', remoteId);
  url.searchParams.set('token', previewToken(subscriber.bell_secret, datatype, remoteId));
  return url.toString();
}
