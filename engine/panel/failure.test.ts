import { describe, expect, it } from 'vitest';
import { databaseFailed, failureWords } from './failure.js';

const coded = (message: string, code: string): Error => Object.assign(new Error(message), { code });

describe('telling Core’s database failing from a fault in Core’s code', () => {
  it('knows the database by its error classes, the network’s codes and the client’s words', () => {
    for (const code of ['08006', '28P01', '3D000', '53300', '57P01', '58030']) {
      expect(databaseFailed(coded('the database said no', code))).toBe(true);
    }
    for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'SELF_SIGNED_CERT_IN_CHAIN']) {
      expect(databaseFailed(coded('', code))).toBe(true);
    }
    for (const message of [
      'Connection terminated unexpectedly',
      'timeout exceeded when trying to connect',
      'Query read timeout',
      'Client has encountered a connection error and is not queryable',
    ]) {
      expect(databaseFailed(new Error(message))).toBe(true);
    }
    expect(databaseFailed(coded('relation "x" does not exist', '42P01'))).toBe(false);
    expect(databaseFailed(new TypeError('x is not a function'))).toBe(false);
  });

  it('says to try a press again, and only how long to wait for a page that reads itself again', () => {
    const lost = new Error('Query read timeout');
    expect(failureWords(lost)).toBe(
      'Core couldn’t use its database, and the database’s error said “Query read timeout”. This is Core’s own database, not a CRM or a CRM login. Try again in a few minutes; if it still fails, pass these words on to Core’s developers.',
    );
    expect(failureWords(lost, { reading: true })).toBe(
      'Core couldn’t use its database, and the database’s error said “Query read timeout”. This is Core’s own database, not a CRM or a CRM login. If this lasts more than a few minutes, pass these words on to Core’s developers.',
    );
    expect(failureWords(new TypeError('x is not a function'), { reading: true })).toBe(
      'Core failed with an error in its own code, which said “x is not a function”. This is a fault in Core, not in a CRM or a login, so pass these words on to Core’s developers.',
    );
  });
});
