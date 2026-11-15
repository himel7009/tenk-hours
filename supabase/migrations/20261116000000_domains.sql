-- Domains: a named group of skills, such as "AI" holding machine learning
-- and deep learning. A skill belongs to at most one domain or stands alone.
--
-- A domain stores no totals of its own. Its hours and streak are derived in
-- the app from the skills inside it.
--
-- Apply this before deploying the app version that reads these columns.

create table public.domains (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default '🧭' check (char_length(icon) between 1 and 16),
  color text not null check (color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create index domains_user_updated_idx on public.domains (user_id, updated_at);

create trigger domains_set_updated_at
  before insert or update on public.domains
  for each row execute function public.set_updated_at();

alter table public.domains enable row level security;

revoke all on public.domains from public, anon, authenticated;
grant select, insert, update on public.domains to authenticated;

create policy "Users read their own domains" on public.domains
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own domains" on public.domains
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own domains" on public.domains
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The composite key means a skill can only join a domain of the same user.
-- If a domain row is ever removed, its skills become standalone.
alter table public.skills
  add column domain_id uuid,
  add constraint skills_domain_id_user_id_fkey
    foreign key (domain_id, user_id) references public.domains (id, user_id)
    on delete set null (domain_id);

create index skills_domain_idx on public.skills (domain_id, user_id) where domain_id is not null;
