-- The forms widget and its browser door are gone (question 155: the theme draws the forms and the
-- site's own server passes them to Core with its token), and with them the public site key and the
-- addresses it could be used from, added in 011. Nothing reads them any more.
alter table subscribers
  drop column if exists site_key,
  drop column if exists origins;
