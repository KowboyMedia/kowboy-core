-- The widget's door (docs/forms.md, "The widget", question 137): every site carries a public site
-- key the browser sends with a form, and the addresses (origins) the key may be used from. The
-- key opens three things only, the forms config, one record's slots and a submission, and it is
-- no secret, so it is stored plain. Empty origins mean the origin of the site's bell URL. Every
-- site that exists gets a key here. Additive.
alter table subscribers
  add column site_key text not null unique default ('pk_' || replace(gen_random_uuid()::text, '-', '')),
  add column origins text[] not null default '{}';
