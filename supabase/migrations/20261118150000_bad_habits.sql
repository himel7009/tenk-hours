-- Bad habits: things to stay away from, tracked with a daily yes or no
-- check-in instead of a timer. A clean day extends the streak; a slip ends it.
--
-- Same rules as the other tables: private to their owner through row level
-- security, soft deletes, and updated_at set by trigger for sync.
--
-- Apply this before deploying the app version that reads these tables.

create table public.bad_habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default '🚫' check (char_length(icon) between 1 and 16),
  color text not null check (color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

-- One row per bad habit per day. The app derives the id from the habit and
-- the day, so two devices answering for the same day write the same row and
-- the later answer wins instead of clashing.
create table public.bad_habit_checkins (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  day date not null,
  status text not null check (status in ('clean', 'slipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (habit_id, user_id) references public.bad_habits (id, user_id) on delete cascade
);

create index bad_habits_user_updated_idx on public.bad_habits (user_id, updated_at);
create index bad_habit_checkins_user_updated_idx on public.bad_habit_checkins (user_id, updated_at);
create index bad_habit_checkins_habit_idx on public.bad_habit_checkins (habit_id, user_id);

create trigger bad_habits_set_updated_at
  before insert or update on public.bad_habits
  for each row execute function public.set_updated_at();

create trigger bad_habit_checkins_set_updated_at
  before insert or update on public.bad_habit_checkins
  for each row execute function public.set_updated_at();

alter table public.bad_habits enable row level security;
alter table public.bad_habit_checkins enable row level security;

revoke all on public.bad_habits, public.bad_habit_checkins from public, anon, authenticated;
grant select, insert, update on public.bad_habits, public.bad_habit_checkins to authenticated;

create policy "Users read their own bad habits" on public.bad_habits
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own bad habits" on public.bad_habits
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own bad habits" on public.bad_habits
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read their own check-ins" on public.bad_habit_checkins
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own check-ins" on public.bad_habit_checkins
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own check-ins" on public.bad_habit_checkins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
