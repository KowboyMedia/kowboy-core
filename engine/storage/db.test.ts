// How the pool is opened: with the managed cluster's CA when the platform hands one over.
import { describe, expect, it } from 'vitest';
import { connectionOptions } from './db.js';

const URL_WITH_SSLMODE = 'postgres://core:pw@db.example:25060/core?sslmode=require';

describe('connectionOptions', () => {
  it('verifies the server against the CA given, and drops the sslmode the URL carries', () => {
    const options = connectionOptions(URL_WITH_SSLMODE, '-----BEGIN CERTIFICATE-----');
    expect(options.ssl).toEqual({ ca: '-----BEGIN CERTIFICATE-----' });
    expect(options.connectionString).toBe('postgres://core:pw@db.example:25060/core');
  });

  it('leaves the URL alone when there is no CA', () => {
    expect(connectionOptions(URL_WITH_SSLMODE, null)).toEqual({
      connectionString: URL_WITH_SSLMODE,
    });
  });
});
