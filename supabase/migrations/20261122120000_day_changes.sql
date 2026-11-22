-- Changes to the weekly routine for single days: days added on top of it and
-- days skipped. They live where the routine lives, on a domain or on a
-- tracker outside one. Kept for good, since past streaks read them.

alter table public.skills
  add column added_days date[] not null default '{}',
  add column skipped_days date[] not null default '{}',
  add constraint skills_day_changes_size check (cardinality(added_days) <= 1000 and cardinality(skipped_days) <= 1000);

alter table public.domains
  add column added_days date[] not null default '{}',
  add column skipped_days date[] not null default '{}',
  add constraint domains_day_changes_size check (cardinality(added_days) <= 1000 and cardinality(skipped_days) <= 1000);
