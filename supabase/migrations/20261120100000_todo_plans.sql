-- To-dos get a place and a day: the domain or skill they belong to (or
-- neither, for General) and the day they were planned for. An undone to-do
-- moves on to the next working day of its domain or skill; the app works
-- that out from the routine, so only the first planned day is stored, and
-- the history reads it.
--
-- No foreign keys: a to-do outlives a deleted domain or skill and becomes
-- General. Existing to-dos are planned for the day they were written.
--
-- Apply this before deploying the app version that writes these columns.

alter table public.todos
  add column domain_id uuid,
  add column skill_id uuid,
  add column day date,
  add constraint todos_one_place check (domain_id is null or skill_id is null);

update public.todos set day = (created_at at time zone 'Asia/Dhaka')::date where day is null;

alter table public.todos alter column day set not null;
alter table public.todos alter column day set default current_date;
