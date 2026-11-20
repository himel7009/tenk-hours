-- Money: sections with budgets, and the entries that fill and spend them.
--
-- money_sections is a pot such as personal expenses, meals or a fund.
-- carry_over says whether its balance rolls into the next month.
-- money_entries is one line of money: 'spend' (out of a section), 'add'
-- (into its budget) or 'move' (from section_id to to_section_id). Amounts
-- are positive whole paisa.
--
-- Same rules as every other table: private to their owner through row level
-- security, soft deletes, updated_at set by trigger for sync, and live
-- updates through the supabase_realtime publication. The composite foreign
-- keys stop an entry from pointing at another user's section.
--
-- Apply this before deploying the app version that reads these tables.

create table public.money_sections (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null check (char_length(icon) between 1 and 16),
  color text not null check (color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose')),
  carry_over boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.money_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  section_id uuid not null,
  kind text not null check (kind in ('spend', 'add', 'move')),
  to_section_id uuid,
  day date not null,
  amount bigint not null check (amount > 0 and amount <= 1000000000),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (section_id, user_id) references public.money_sections (id, user_id) on delete cascade,
  foreign key (to_section_id, user_id) references public.money_sections (id, user_id) on delete cascade,
  check ((kind = 'move') = (to_section_id is not null)),
  check (to_section_id is distinct from section_id)
);

create index money_sections_user_updated_idx on public.money_sections (user_id, updated_at);
create index money_entries_user_updated_idx on public.money_entries (user_id, updated_at);
create index money_entries_section_idx on public.money_entries (section_id, user_id);
create index money_entries_to_section_idx on public.money_entries (to_section_id, user_id);

create trigger money_sections_set_updated_at
  before insert or update on public.money_sections
  for each row execute function public.set_updated_at();

create trigger money_entries_set_updated_at
  before insert or update on public.money_entries
  for each row execute function public.set_updated_at();

alter table public.money_sections enable row level security;
alter table public.money_entries enable row level security;

revoke all on public.money_sections, public.money_entries from public, anon, authenticated;
grant select, insert, update on public.money_sections, public.money_entries to authenticated;

create policy "Users read their own money sections" on public.money_sections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own money sections" on public.money_sections
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own money sections" on public.money_sections
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users read their own money entries" on public.money_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own money entries" on public.money_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own money entries" on public.money_entries
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.money_sections, public.money_entries;
