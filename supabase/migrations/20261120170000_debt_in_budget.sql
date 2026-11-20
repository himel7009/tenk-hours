-- A debt is a record of who the money came from or went to. It changes a
-- section's balance only when in_budget is on: money that was already in the
-- budget (and was spent from it) must not be counted a second time.
-- Existing debts start as records only.

alter table public.money_debts add column in_budget boolean not null default false;
