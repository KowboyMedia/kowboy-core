// The words a failed fetch leaves under its record, read whole as the panel shows them, with the
// answers staging met on 2026-10-18: what failed with whoever's own words, whose fault it is, and
// what to do (Patric: "should I bug report it to you or Vitec or is credentials incorrect").
import { describe, expect, it } from 'vitest';
import * as connect from './api.js';
import { failureInWords, NotSaved, sentence, whatToDo } from './words.js';

const note = (error: unknown): string =>
  `${sentence(failureInWords(error))} ${whatToDo(error)}`.trim();

describe('the words of a failed fetch', () => {
  it('quotes Vitec’s own words for a failure of Vitec’s service, and sends it to Vitec’s support', () => {
    const error = new connect.VitecError(
      500,
      'Advertising/Estate/M16986/OBJ16986_1874258269: HTTP 500 { "message": "An unexpected error occured", "type": "Unhandled" }',
      false,
      'An unexpected error occured',
    );
    expect(note(error)).toBe(
      'Vitec’s service did not work, with Vitec’s answer code 500 and the words “An unexpected error occured”. This is a fault at Vitec, not in Core or the login. If it still fails after a retry, report it to Vitec’s support with the record’s Vitec id and what Vitec answered.',
    );
  });

  it('quotes Core’s own error when Core could not save what Vitec sent, and sends it to Core’s developers', () => {
    const error = new NotSaved(new Error('unsupported Unicode escape sequence'));
    expect(note(error)).toBe(
      'Vitec answered, but Core could not save what it sent, and Core’s error said “unsupported Unicode escape sequence”. This is a fault in Core, not at Vitec or in the login, so pass it on to Core’s developers.',
    );
  });

  it('sends a refused login to the brokerage', () => {
    const error = new connect.VitecError(403, 'Advertising/Estate/M1/OBJ1: HTTP 403', false, null);
    expect(note(error)).toBe(
      'Vitec does not let this login read it, with Vitec’s answer code 403. This is the login, not Core or Vitec’s service: check with the brokerage that it may still read this office in Vitec, and enter the new login if it changed.',
    );
  });

  it('says nothing needs doing when Vitec only asks Core to call less often', () => {
    const error = new connect.VitecError(429, 'Advertising/Estate/M1/OBJ1: HTTP 429', false, null);
    expect(note(error)).toBe(
      'Vitec asked Core to call less often, with Vitec’s answer code 429. Core calls less often by itself, so nothing needs doing.',
    );
  });

  it('sends a call Vitec turned down to Core’s developers, with Vitec’s words without a doubled full stop', () => {
    const error = new connect.VitecError(
      400,
      'Advertising/Estate/M1/OBJ 1: HTTP 400',
      false,
      'The id is not valid.',
    );
    expect(note(error)).toBe(
      'Vitec turned the call down, with Vitec’s answer code 400 and the words “The id is not valid”. Vitec turned down the call Core made, so pass it on to Core’s developers, who can tell whether Core asked wrongly or the record is wrong at Vitec.',
    );
  });

  it('tells a call that never reached Vitec from a fault in Core’s own code', () => {
    const unreached = new TypeError('fetch failed', {
      cause: new Error('getaddrinfo ENOTFOUND connect.maklare.vitec.net'),
    });
    expect(note(unreached)).toBe(
      'Core could not reach Vitec, and the network said “getaddrinfo ENOTFOUND connect.maklare.vitec.net”. This is most often a short break at Vitec or on the way there, and Core tries again by itself. If it lasts for hours, pass it on to Core’s developers.',
    );
    const bug = new TypeError("Cannot read properties of undefined (reading 'rows')");
    expect(note(bug)).toBe(
      "Core could not make the call to Vitec, and Core’s error said “Cannot read properties of undefined (reading 'rows')”. This is a fault in Core, not at Vitec or in the login, so pass it on to Core’s developers.",
    );
  });

  it('says Vitec is slow when it did not answer in time, and adds nothing to a refused office', () => {
    const late = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    expect(note(late)).toBe(
      'Vitec did not answer within 30 seconds. This is Vitec being slow or down, not Core or the login. If it still fails after a retry, ask Vitec’s support whether their service works.',
    );
    expect(whatToDo(new connect.Blocked('live', 'M1'))).toBe('');
  });
});
