// The panel's words for how a CRM connection is coming along, read whole as a person sees them:
// the offices a check put on the website, what a changed login's office check found, what a check
// started from the tenant's page changed, how far the first load has come, and the instructions
// "Copy instructions" copies. The CRM's name and its words are a stand-in's.
import { describe, expect, it } from 'vitest';
import {
  checkDoneWords,
  instructions,
  loading,
  loginCheckedWords,
  officesOnWords,
  type FirstLoad,
  type OfficeCheck,
} from './progress';

const AT = '2026-10-21T08:09:00.000Z';
const NOW = new Date('2026-10-21T09:00:00.000Z');
const WHY = 'it isn’t in the CRM’s office group “Web”';

const check = (given: Partial<OfficeCheck> = {}): OfficeCheck => ({
  at: AT,
  on: [
    { name: 'Varberg', addedAt: null },
    { name: 'Falkenberg', addedAt: null },
  ],
  off: [],
  added: [],
  removed: [],
  ...given,
});

const counts = (given: Partial<FirstLoad['listed']>): FirstLoad['listed'] => ({
  property: 0,
  project: 0,
  agent: 0,
  office: 0,
  area: 0,
  association: 0,
  ...given,
});

describe('how a connection comes along, in words', () => {
  it('names the offices on the website and why the others stay off', () => {
    expect(officesOnWords(check({ off: [{ name: 'Kungsbacka', why: WHY }] }))).toBe(
      'Offices on the website: Varberg and Falkenberg. Kungsbacka stays off: it isn’t in the CRM’s office group “Web”.',
    );
    expect(
      officesOnWords(
        check({
          on: [{ name: 'Varberg', addedAt: null }],
          off: [
            { name: 'Nacka', why: WHY },
            { name: 'Huddinge', why: WHY },
            { name: 'Kista', why: 'the CRM lists no properties for it.' },
          ],
        }),
      ),
    ).toBe(
      'Office on the website: Varberg. Nacka and Huddinge stay off: it isn’t in the CRM’s office group “Web”. Kista stays off: the CRM lists no properties for it.',
    );
  });

  it('says what a changed login’s office check found, and that held changes are fetched', () => {
    expect(loginCheckedWords('Somecrm', check(), '2026-10-21T04:02:00.000Z', null, NOW)).toBe(
      'Somecrm accepted the new login. Office check done: both offices OK. Changes held since 06:02 are being fetched.',
    );
    const one = check({ on: [{ name: 'Varberg', addedAt: null }] });
    expect(loginCheckedWords('Somecrm', one, null, null, NOW)).toBe(
      'Somecrm accepted the new login. Office check done: the office is OK.',
    );
    const three = check({
      on: [...check().on, { name: 'Halmstad', addedAt: null }],
    });
    // Changes still held after the save are not said to be fetched.
    expect(loginCheckedWords('Somecrm', three, AT, AT, NOW)).toBe(
      'Somecrm accepted the new login. Office check done: all 3 offices OK.',
    );
    const off = check({ off: [{ name: 'Kungsbacka', why: WHY }] });
    expect(loginCheckedWords('Somecrm', off, null, null, NOW)).toBe(
      'Somecrm accepted the new login. Office check done: 2 of 3 offices OK; Kungsbacka stays off: it isn’t in the CRM’s office group “Web”.',
    );
  });

  it('says what a check started from the tenant’s page changed', () => {
    const taby = { name: 'Täby', properties: 17, waiting: 0, websites: 2 };
    expect(checkDoneWords(check({ added: [taby] }), 2)).toBe(
      'Office check done: Täby added, and its 17 properties are on both websites.',
    );
    expect(checkDoneWords(check({ added: [{ ...taby, waiting: 5 }] }), 2)).toBe(
      'Office check done: Täby added, and Core is still loading its properties (17 properties so far).',
    );
    expect(checkDoneWords(check({ added: [{ ...taby, websites: 1 }] }), 2)).toBe(
      'Office check done: Täby added, and its 17 properties are on 1 of 2 websites; the others get them at their next fetch.',
    );
    expect(checkDoneWords(check({ added: [{ ...taby, websites: 0 }] }), 1)).toBe(
      'Office check done: Täby added; its 17 properties reach the website at its next fetch.',
    );
    expect(checkDoneWords(check({ removed: ['Nacka'] }), 2)).toBe(
      'Office check done: Nacka taken off the websites.',
    );
    expect(checkDoneWords(check(), 2)).toBe('Office check done: no change.');
  });

  it('counts the first load by its properties, and says nothing of it once it is done', () => {
    expect(
      loading({
        listed: counts({ property: 61, agent: 14 }),
        loaded: counts({ property: 38, agent: 14 }),
        done: false,
      }),
    ).toEqual({ words: 'Loading data, 38 of 61 properties', done: 38, of: 61 });
    expect(loading({ listed: counts({}), loaded: counts({}), done: false })).toEqual({
      words: 'Loading data',
      done: 0,
      of: 0,
    });
    expect(loading({ listed: counts({ property: 2 }), loaded: counts({}), done: true })).toBeNull();
  });

  it('copies every step numbered, with its value in full', () => {
    expect(
      instructions([
        {
          text: 'Send the notices to this address:',
          value: 'https://core.example/v1/hook/somecrm/secret',
          secret: true,
          help: 'The same for every connection.',
          note: null,
        },
        {
          text: 'Subscribe it to every change.',
          value: null,
          secret: false,
          help: null,
          note: null,
        },
      ]),
    ).toBe(
      '1. Send the notices to this address:\n   https://core.example/v1/hook/somecrm/secret\n2. Subscribe it to every change.',
    );
  });
});
