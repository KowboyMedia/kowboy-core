// The panel's words for what went wrong, read whole as a person sees them (Patric, 2026-10-18):
// Core's own words when it gave them, else what its answer code means, whose fault it is and what
// to do.
import { describe, expect, it } from 'vitest';
import { Refused } from './api';
import { failureWords, GONE } from './failure';

describe('what the panel says went wrong', () => {
  it('shows Core’s own words for what failed inside it', () => {
    const said =
      'The part of Core that talks to Vitec failed, and its error said “relation "vitec_fetch_list" does not exist”. This is a fault in Core, not at Vitec or in the login, so pass these words on to Core’s developers.';
    expect(failureWords(new Refused(502, 'crm', said))).toBe(said);
  });

  it('says Core didn’t answer when its answer never came', () => {
    expect(failureWords(new TypeError('Failed to fetch'))).toBe(
      'Core didn’t answer. Check that this device is online. If it is, Core may be restarting after an update, which takes a minute or two; if this lasts, pass it on to Core’s developers.',
    );
  });

  it('says Core is restarting when something answered in its place', () => {
    expect(failureWords(new Refused(503, ''))).toBe(
      'Core isn’t answering right now (answer code 503), most often because it is restarting after an update. Try again in a minute or two; if this lasts, pass it on to Core’s developers.',
    );
  });

  it('says what the page showed is gone, and to reload it', () => {
    expect(failureWords(new Refused(404, 'missing'))).toBe(GONE);
    expect(GONE).toBe(
      'Core no longer has this: it was removed or changed meanwhile. Reload the page to see what is there now.',
    );
  });

  it('names an error and a refusal Core gave no words for, with whose fault each is', () => {
    expect(failureWords(new Refused(500, 'internal error'))).toBe(
      'Core failed with an error of its own and could not say which. This is a fault in Core, not in a CRM or a login: try again in a minute, and if it fails again, pass it on to Core’s developers.',
    );
    expect(failureWords(new Refused(400, 'fields'))).toBe(
      'Core refused this, with answer code 400 and the reason “fields”. This is a fault in Core’s admin panel, not in a CRM or a login, so pass it on to Core’s developers.',
    );
  });
});
