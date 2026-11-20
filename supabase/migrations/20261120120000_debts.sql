-- Debts: money borrowed (you owe someone) or lent (someone owes you), with
-- an optional deadline, and the payments that settle them. A debt can name
-- the money section the money went into or came out of, and each payment
-- the section it was paid from or into, so section balances stay true.
--
-- section_id has no foreign key: sections are only ever soft deleted, and a
-- debt outlives the section it once touched. Payments belong to their debt.
-- Same rules as every other table: private through row level security, soft
-- deletes, updated_at for sync, and live updates.
--
-- Apply this before deploying the app version that reads these tables.

create table public.money_debts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction text not null check (direction in ('borrowed', 'lent')),
  person text not null check (char_length(person) between 1 and 80),
  amount bigint not null check (amount > 0 and amount <= 1000000000),
  day date not null,
  due_day date,
  section_id uuid,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.money_debt_payments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debt_id uuid not null,
  day date not null,
  amount bigint not null check (amount > 0 and amount <= 1000000000),
  section_id uuid,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (debt_id, user_id) references public.money_debts (id, user_id) on delete cascade
);

create index money_debts_user_updated_idx on public.money_debts (user_id, updated_at);
create index money_debt_payments_user_updated_idx on public.money_debt_payments (user_id, updated_at);
create index money_debt_payments_debt_idx on public.money_debt_payments (debt_id, user_id);

create trigger money_debts_set_updated_at
  before insert or update on public.money_debts
  for each row execute function public.set_updated_at();

create trigger money_debt_payments_set_updated_at
  before insert or update on public.money_debt_payments
  for each row execute function public.set_updated_at();

alter table public.money_debts enable row level security;
alter table public.money_debt_payments enable row level security;

revoke all on public.money_debts, public.money_debt_payments from public, anon, authenticated;
grant select, insert, update on public.money_debts, public.money_debt_payments to authenticated;

create policy "Users read their own debts" on public.money_debts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own debts" on public.money_debts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own debts" on public.money_debts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users read their own debt payments" on public.money_debt_payments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own debt payments" on public.money_debt_payments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own debt payments" on public.money_debt_payments
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.money_debts, public.money_debt_payments;
