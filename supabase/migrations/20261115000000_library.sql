-- Library: books and courses a user is working through, with how far they
-- have got and their own notes.
--
-- Follows the same rules as skills and sessions: rows are private to their
-- owner through row level security, deletes are soft, and updated_at is set
-- by trigger so devices can pull what changed.
--
-- Apply this before deploying the app version that reads this table.

create table public.library_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('book', 'course')),
  title text not null check (char_length(title) between 1 and 120),
  author text not null default '' check (char_length(author) <= 120),
  -- Only web links are accepted, so a stored value can never be a
  -- javascript: or data: URL when the app renders it as a link.
  url text not null default '' check (url = '' or (url ~* '^https?://' and char_length(url) <= 500)),
  unit text not null check (unit in ('chapter', 'page', 'lesson')),
  total_units integer check (total_units between 1 and 100000),
  done_units integer not null default 0 check (done_units between 0 and 100000),
  position text not null default '' check (char_length(position) <= 200),
  notes text not null default '' check (char_length(notes) <= 4000),
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index library_items_user_updated_idx on public.library_items (user_id, updated_at);

create trigger library_items_set_updated_at
  before insert or update on public.library_items
  for each row execute function public.set_updated_at();

alter table public.library_items enable row level security;

-- Supabase grants ALL to anon and authenticated on new public tables, so
-- revoke first and grant back only what the app uses.
revoke all on public.library_items from public, anon, authenticated;
grant select, insert, update on public.library_items to authenticated;

create policy "Users read their own library" on public.library_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add to their own library" on public.library_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own library" on public.library_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
