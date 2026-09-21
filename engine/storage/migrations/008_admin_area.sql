-- The admin area (docs/admin-panel-design.md): the people who may open it, their sessions, and
-- the switches a person throws from Settings. Everything here is additive.

-- A sign-in link: mailed to an allowed address, good once and for a short while. Only the hash of
-- the link's token is stored, so a leaked row opens nothing.
create table admin_logins (
  token_hmac text primary key,
  email      text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index admin_logins_expiry on admin_logins(expires_at);

-- The session a used link makes. Hashed the same way; the browser holds the value in one cookie.
create table admin_sessions (
  token_hmac   text primary key,
  email        text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index admin_sessions_expiry on admin_sessions(expires_at);

-- Switches a person throws from the panel, one row per key. Today: maintenance.
create table settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
