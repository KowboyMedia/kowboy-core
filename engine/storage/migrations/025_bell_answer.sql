-- What a website last answered to Core's change notice, or why it did not answer, the first 300
-- characters, replaced at each notice; the Inbox's card "{website} stopped updating" quotes it
-- after the answer code (question 212 a). Additive.
alter table subscribers add column if not exists last_bell_answer text;
