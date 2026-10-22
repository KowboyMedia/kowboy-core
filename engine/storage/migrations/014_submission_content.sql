-- A form's details until the CRM has them (question 160 a): the submission as the site sent it,
-- encrypted with the key of the CRM logins. The content goes the moment the CRM takes the form; a
-- form the CRM refused or never answered keeps it, with the CRM's answer, for 30 days, so it can be
-- read and sent again. Additive.
alter table submissions add column content text;
