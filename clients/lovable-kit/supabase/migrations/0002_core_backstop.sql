-- The 15 minute backstop (SRS §8): a bell can be lost, so the sync also runs on a schedule.
-- pg_cron calls the function through pg_net, with the URL and the bell secret read from Vault, so
-- nothing secret is written here. Create the two secrets once per site, before this migration:
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/core-sync', 'core_sync_url');
--   select vault.create_secret('<bell secret>', 'core_bell_secret');

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'core-sync-backstop',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'core_sync_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-core-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'core_bell_secret')
    ),
    body := '{"kind":"delta"}'::jsonb
  )
  $$
);
