-- Form submissions (docs/forms.md, approved with question 130): the outcome of each form a site
-- posted through Core, so a repeated id answers the same and sends nothing twice, the admin area
-- counts them per connection, and the health check reads the latest. The id, the kind, the
-- record and what the CRM said; never the person, who lives in the CRM. Additive.
create table submissions (
  id            uuid primary key,
  tenant_id     integer not null references tenants(id) on delete cascade,
  connection_id text not null references connections(id) on delete cascade,
  kind          text not null,
  datatype      text,
  remote_id     text,
  office_id     text,
  -- received while the CRM is asked; then delivered, refused or failed
  outcome       text not null,
  -- the CRM's own id for what it made (a contact, a booking)
  reference     text,
  -- the refusal's reason or the failure's cause, in the CRM's words
  detail        text,
  received_at   timestamptz not null default now(),
  answered_at   timestamptz
);
create index submissions_connection on submissions(connection_id, received_at desc);
create index submissions_tenant on submissions(tenant_id, received_at desc);
