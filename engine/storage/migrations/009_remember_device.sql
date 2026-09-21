-- "Remember this device" (Patric, 2026-09-21): the choice is made when the link is asked for and
-- has to survive until the link is opened, because that is when the session is made. A person may
-- be remembered on as many devices as they like: every device opens its own link and gets its own
-- row in admin_sessions, and one device forgetting another is not a thing that can happen.
alter table admin_logins add column remember boolean not null default false;

-- What a session was made as, so the Settings page can list a person's remembered devices and
-- say when each was last used.
alter table admin_sessions add column remembered boolean not null default false;
alter table admin_sessions add column device text;
