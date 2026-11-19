-- To-dos: a plain checklist. No dates or history; done items stay until the
-- user clears them, which soft-deletes them like every other row.
--
-- Same rules as the other tables: private to their owner through row level
-- security, soft deletes, and updated_at set by trigger for sync.
--
-- Apply this before deploying the app version that reads this table.

create table public.todos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index todos_user_updated_idx on public.todos (user_id, updated_at);

create trigger todos_set_updated_at
  before insert or update on public.todos
  for each row execute function public.set_updated_at();

alter table public.todos enable row level security;

revoke all on public.todos from public, anon, authenticated;
grant select, insert, update on public.todos to authenticated;

create policy "Users read their own to-dos" on public.todos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own to-dos" on public.todos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own to-dos" on public.todos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
