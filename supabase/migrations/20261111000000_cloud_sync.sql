-- Tenk cloud sync: per-user skills and sessions.
--
-- Security model: the browser talks to this database directly using the
-- publishable key, so every rule that matters is enforced here. Row level
-- security limits each signed-in user to their own rows, and check
-- constraints bound what a client can store.

create table public.skills (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose')),
  target_hours integer not null check (target_hours between 1 and 100000),
  created_at timestamptz not null default now(),
  -- Set by trigger, never by the client. Devices pull rows changed since
  -- their last sync using this column.
  updated_at timestamptz not null default now(),
  -- Deletes are soft so other devices learn about them on their next pull.
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  skill_id uuid not null,
  day date not null,
  minutes integer not null check (minutes between 1 and 1440),
  note text not null default '' check (char_length(note) <= 140),
  source text not null check (source in ('timer', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Composite key so a session can only point at a skill of the same user.
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete cascade
);

create index skills_user_updated_idx on public.skills (user_id, updated_at);
create index sessions_user_updated_idx on public.sessions (user_id, updated_at);
create index sessions_skill_idx on public.sessions (skill_id, user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger skills_set_updated_at
  before insert or update on public.skills
  for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
  before insert or update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.skills enable row level security;
alter table public.sessions enable row level security;

-- Signed-out visitors get nothing; signed-in users get their own rows only.
revoke all on public.skills, public.sessions from anon;
grant select, insert, update on public.skills, public.sessions to authenticated;

create policy "Users read their own skills" on public.skills
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own skills" on public.skills
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own skills" on public.skills
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read their own sessions" on public.sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own sessions" on public.sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own sessions" on public.sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Lets a user delete their account from the app. Skills and sessions go with
-- it through the foreign keys. Runs as the function owner because users
-- cannot touch auth.users directly; it can only ever delete the caller.
create function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
