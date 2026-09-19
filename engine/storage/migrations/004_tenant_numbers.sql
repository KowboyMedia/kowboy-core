-- Tenants get numbers (Patric, 2026-09-19): the id is assigned by Core and separate from the name,
-- which is the only thing a person types. Nothing is released, but staging's rows are kept: every
-- tenant gets its number and every reference follows it.
alter table tenants add column number integer generated always as identity;

alter table connections add column tenant_number integer;
update connections c set tenant_number = t.number from tenants t where t.id = c.tenant_id;
alter table subscribers add column tenant_number integer;
update subscribers s set tenant_number = t.number from tenants t where t.id = s.tenant_id;
alter table items add column tenant_number integer;
update items i set tenant_number = t.number from tenants t where t.id = i.tenant_id;
alter table events add column tenant_number integer;
update events e set tenant_number = t.number from tenants t where t.id = e.tenant_id;

alter table connections drop column tenant_id;
alter table connections rename column tenant_number to tenant_id;
alter table subscribers drop column tenant_id;
alter table subscribers rename column tenant_number to tenant_id;
alter table items drop column tenant_id;
alter table items rename column tenant_number to tenant_id;
alter table events drop column tenant_id;
alter table events rename column tenant_number to tenant_id;

alter table tenants drop constraint tenants_pkey;
alter table tenants drop column id;
alter table tenants rename column number to id;
alter table tenants add primary key (id);

alter table connections alter column tenant_id set not null;
alter table connections add foreign key (tenant_id) references tenants(id) on delete cascade;
create index connections_tenant on connections(tenant_id);
alter table subscribers alter column tenant_id set not null;
alter table subscribers add foreign key (tenant_id) references tenants(id) on delete cascade;
create index subscribers_tenant on subscribers(tenant_id);
alter table items alter column tenant_id set not null;
alter table items add foreign key (tenant_id) references tenants(id) on delete cascade;
alter table items add primary key (tenant_id, connection_id, datatype, remote_id);
create index items_cursor on items(tenant_id, datatype, seq);
