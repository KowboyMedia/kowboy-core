// Test defaults. CI supplies DATABASE_URL; locally this points at a throwaway database.
process.env['DATABASE_URL'] ??= 'postgres://core:core@127.0.0.1:5432/core';
process.env['ADMIN_SECRET'] ??= 'test-admin-secret';
// 32 zero bytes: a valid shape for tests, never for anything real.
process.env['CREDENTIALS_KEY'] ??= Buffer.alloc(32).toString('base64');
process.env['PORT'] ??= '0';
process.env['BELL_THROTTLE_MS'] ??= '50';
