-- Projects: a third kind of tracker next to skills and habits. A project only
-- adds up the time spent on it, with no target hours, daily goal or streak.
-- Like a skill it can sit in a domain.
--
-- Apply this before deploying the app version that writes this kind.

alter table public.skills
  drop constraint skills_kind_check,
  add constraint skills_kind_check check (kind in ('skill', 'habit', 'project'));
