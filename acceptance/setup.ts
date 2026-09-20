// Test defaults. CI supplies DATABASE_URL; locally this points at a throwaway database.
process.env['DATABASE_URL'] ??= 'postgres://core:core@127.0.0.1:5432/core';
// 32 zero bytes: a valid shape for tests, never for anything real.
process.env['CREDENTIALS_KEY'] ??= Buffer.alloc(32).toString('base64');
process.env['PORT'] ??= '0';
process.env['BELL_THROTTLE_MS'] ??= '50';
// Who may open the admin area in a test run, and the address the journeys sign in with.
process.env['ADMIN_EMAILS'] ??= 'tester@kowboy.se';
// The Vitec adapter's speed limit would slow the suites; one test lowers it on purpose.
process.env['VITEC_REQUESTS_PER_SECOND'] ??= '1000';
