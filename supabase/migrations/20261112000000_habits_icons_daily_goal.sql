-- Habits, icons and daily goals.
--
-- A row in `skills` is now either a skill or a habit. Both carry an emoji
-- icon and the number of minutes a day must reach to count towards the
-- streak. Existing rows become skills with a one hour goal.
--
-- Apply this before deploying the app version that reads these columns.

alter table public.skills
  add column kind text not null default 'skill'
    check (kind in ('skill', 'habit')),
  add column icon text not null default '🎯'
    check (char_length(icon) between 1 and 16),
  add column daily_goal_minutes integer not null default 60
    check (daily_goal_minutes between 1 and 1440);
