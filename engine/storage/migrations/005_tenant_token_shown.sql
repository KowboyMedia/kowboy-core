-- Tenant tokens are shown on the tenant page at all times (Patric, 2026-09-19), not only once when
-- made. The token is kept recoverable beside its hmac: encrypted with CREDENTIALS_KEY, the same way
-- connection credentials are, so a leaked database row is not a usable token. The hmac stays the
-- lookup key for a site's pull (a deterministic hash, indexable and compared in constant time); the
-- encrypted copy is only for display. Existing tenants have no encrypted copy, so their token stays
-- hidden until it is rotated; every new tenant and every rotation stores it.
alter table tenants add column token_enc text;
