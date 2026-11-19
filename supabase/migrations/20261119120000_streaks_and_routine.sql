-- Optional streaks and a weekly routine.
--
-- keep_streak: whether a skill, habit or project counts a streak. Skills and
-- habits always did, projects never did, so existing rows keep that.
-- routine_days: weekdays (0 = Sunday) something is planned for; empty means
-- every day. A domain's routine applies to every skill in it.
--
-- Apply this before deploying the app version that writes these columns.

alter table public.skills
  add column keep_streak boolean not null default true,
  add column routine_days smallint[] not null default '{}'
    constraint skills_routine_days_check
    check (routine_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(routine_days) <= 7);

update public.skills set keep_streak = false where kind = 'project';

alter table public.domains
  add column routine_days smallint[] not null default '{}'
    constraint domains_routine_days_check
    check (routine_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(routine_days) <= 7);
