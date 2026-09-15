// Test defaults. CI supplies DATABASE_URL; locally this points at a throwaway database.
process.env['DATABASE_URL'] ??= 'postgres://core:core@127.0.0.1:5432/core';
process.env['ADMIN_SECRET'] ??= 'test-admin-secret';
process.env['CREDENTIALS_KEY'] ??= 'test-credentials-key';
process.env['PORT'] ??= '0';
process.env['BELL_THROTTLE_MS'] ??= '50';
