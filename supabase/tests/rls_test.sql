-- Checks the access rules in the migration. Run against a database that has
-- the migration applied:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
--
-- Everything runs in a transaction that is rolled back at the end.

begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

create function pg_temp.expect_error(statement text, label text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok: % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % was allowed', label;
end;
$$;

create function pg_temp.expect_count(query text, expected bigint, label text) returns void
language plpgsql as $$
declare actual bigint;
begin
  execute 'select count(*) from (' || query || ') q' into actual;
  if actual <> expected then
    raise exception 'FAILED: % (expected %, got %)', label, expected, actual;
  end if;
  raise notice 'ok: %', label;
end;
$$;

create function pg_temp.expect_affected(statement text, expected bigint, label text) returns void
language plpgsql as $$
declare actual bigint;
begin
  execute statement;
  get diagnostics actual = row_count;
  if actual <> expected then
    raise exception 'FAILED: % (expected % rows, got %)', label, expected, actual;
  end if;
  raise notice 'ok: %', label;
end;
$$;

-- User A creates a skill and a session.
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a');
insert into public.skills (id, name, color, target_hours)
  values ('10000000-0000-0000-0000-000000000001', 'Python', 'moss', 10000);
insert into public.sessions (id, skill_id, day, minutes, source)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-11', 60, 'timer');
select pg_temp.expect_count('select 1 from public.skills', 1, 'A sees their skill');

select pg_temp.expect_error(
  $$insert into public.skills (id, user_id, name, color, target_hours)
    values ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000b', 'x', 'moss', 1)$$,
  'A cannot insert a row owned by B');
select pg_temp.expect_error(
  $$insert into public.sessions (id, skill_id, day, minutes, source)
    values ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '2026-11-11', 5000, 'timer')$$,
  'minutes are bounded');
select pg_temp.expect_error(
  $$delete from public.skills$$,
  'hard deletes are not granted');

insert into public.library_items (id, kind, title, unit, url)
  values ('30000000-0000-0000-0000-000000000001', 'book', 'Deep Learning', 'chapter', 'https://example.com/book');
select pg_temp.expect_count('select 1 from public.library_items', 1, 'A sees their library item');
select pg_temp.expect_error(
  $$insert into public.library_items (id, kind, title, unit, url)
    values ('30000000-0000-0000-0000-000000000009', 'book', 'x', 'chapter', 'javascript:alert(1)')$$,
  'library links must be web links');
insert into public.library_items (id, kind, title, unit, status)
  values ('30000000-0000-0000-0000-000000000002', 'course', 'For later', 'lesson', 'planned');
select pg_temp.expect_error(
  $$insert into public.library_items (id, kind, title, unit, status)
    values ('30000000-0000-0000-0000-000000000003', 'course', 'x', 'lesson', 'someday')$$,
  'library status must be a known one');
select pg_temp.expect_error(
  $$delete from public.library_items$$,
  'library hard deletes are not granted');

insert into public.domains (id, name, color)
  values ('40000000-0000-0000-0000-000000000001', 'AI', 'cobalt');
update public.skills set domain_id = '40000000-0000-0000-0000-000000000001'
  where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.expect_count(
  'select 1 from public.skills where domain_id is not null', 1, 'A groups a skill under their domain');
select pg_temp.expect_error(
  $$delete from public.domains$$,
  'domain hard deletes are not granted');

insert into public.bad_habits (id, name, color)
  values ('50000000-0000-0000-0000-000000000001', 'Doomscrolling', 'rose');
insert into public.bad_habit_checkins (id, habit_id, day, status)
  values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-11-18', 'clean');
select pg_temp.expect_count('select 1 from public.bad_habit_checkins', 1, 'A logs a check-in');
select pg_temp.expect_error(
  $$insert into public.bad_habit_checkins (id, habit_id, day, status)
    values ('60000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000001', '2026-11-17', 'maybe')$$,
  'check-in status must be clean or slipped');
select pg_temp.expect_error(
  $$delete from public.bad_habit_checkins$$,
  'check-in hard deletes are not granted');

insert into public.todos (id, title)
  values ('70000000-0000-0000-0000-000000000001', 'Read chapter 4');
select pg_temp.expect_count('select 1 from public.todos', 1, 'A adds a to-do');
select pg_temp.expect_error(
  $$insert into public.todos (id, title) values ('70000000-0000-0000-0000-000000000002', '')$$,
  'a to-do needs a title');
select pg_temp.expect_error($$delete from public.todos$$, 'to-do hard deletes are not granted');

insert into public.money_sections (id, name, icon, color)
  values ('80000000-0000-0000-0000-000000000001', 'Meal', '🍚', 'moss');
insert into public.money_entries (id, section_id, kind, day, amount, note)
  values ('80000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000001',
    'spend', '2026-11-17', 93800, 'Gulsha mach');
select pg_temp.expect_count('select 1 from public.money_entries', 1, 'A logs an expense');
select pg_temp.expect_error(
  $$insert into public.money_entries (id, section_id, kind, day, amount)
    values ('80000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000001',
      'spend', '2026-11-17', 0)$$,
  'an amount must be positive');
select pg_temp.expect_error(
  $$insert into public.money_entries (id, section_id, kind, day, amount)
    values ('80000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000001',
      'move', '2026-11-17', 100)$$,
  'a move needs a section to move to');
select pg_temp.expect_error($$delete from public.money_entries$$, 'money hard deletes are not granted');
insert into public.money_debts (id, direction, person, amount, day, due_day)
  values ('90000000-0000-0000-0000-000000000001', 'borrowed', 'Rahim', 100000, '2026-11-10', '2026-11-30');
insert into public.money_debt_payments (id, debt_id, day, amount)
  values ('90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000001', '2026-11-15', 50000);
select pg_temp.expect_count('select 1 from public.money_debt_payments', 1, 'A records a payment');
select pg_temp.expect_error(
  $$insert into public.money_debts (id, direction, person, amount, day)
    values ('90000000-0000-0000-0000-000000000002', 'gifted', 'X', 100, '2026-11-10')$$,
  'a debt is borrowed or lent');

-- User B sees nothing of A's and cannot change or reference it.
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_count('select 1 from public.skills', 0, 'B cannot read A''s skills');
select pg_temp.expect_count('select 1 from public.sessions', 0, 'B cannot read A''s sessions');
select pg_temp.expect_affected(
  $$update public.skills set name = 'hacked'$$, 0, 'B cannot update A''s skill');
select pg_temp.expect_error(
  $$insert into public.skills (id, name, color, target_hours)
    values ('10000000-0000-0000-0000-000000000001', 'taken', 'moss', 1)
    on conflict (id) do update set name = excluded.name$$,
  'B cannot upsert over A''s skill id');
select pg_temp.expect_error(
  $$insert into public.sessions (id, skill_id, day, minutes, source)
    values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-11-11', 30, 'manual')$$,
  'B cannot log a session against A''s skill');

select pg_temp.expect_count('select 1 from public.library_items', 0, 'B cannot read A''s library');
select pg_temp.expect_affected(
  $$update public.library_items set notes = 'hacked'$$, 0, 'B cannot update A''s library item');
select pg_temp.expect_error(
  $$insert into public.library_items (id, kind, title, unit)
    values ('30000000-0000-0000-0000-000000000001', 'book', 'taken', 'chapter')
    on conflict (id) do update set title = excluded.title$$,
  'B cannot upsert over A''s library item id');

select pg_temp.expect_count('select 1 from public.domains', 0, 'B cannot read A''s domains');
select pg_temp.expect_affected(
  $$update public.domains set name = 'hacked'$$, 0, 'B cannot update A''s domain');
select pg_temp.expect_error(
  $$insert into public.skills (id, name, color, target_hours, domain_id)
    values ('10000000-0000-0000-0000-000000000005', 'x', 'moss', 1, '40000000-0000-0000-0000-000000000001')$$,
  'B cannot put a skill into A''s domain');

select pg_temp.expect_count('select 1 from public.bad_habits', 0, 'B cannot read A''s bad habits');
select pg_temp.expect_count('select 1 from public.bad_habit_checkins', 0, 'B cannot read A''s check-ins');
select pg_temp.expect_affected(
  $$update public.bad_habit_checkins set status = 'slipped'$$, 0, 'B cannot change A''s check-ins');
select pg_temp.expect_count('select 1 from public.todos', 0, 'B cannot read A''s to-dos');
select pg_temp.expect_count('select 1 from public.money_sections', 0, 'B cannot read A''s money sections');
select pg_temp.expect_count('select 1 from public.money_entries', 0, 'B cannot read A''s money entries');
select pg_temp.expect_count('select 1 from public.money_debts', 0, 'B cannot read A''s debts');
select pg_temp.expect_error(
  $$insert into public.money_debt_payments (id, debt_id, day, amount)
    values ('90000000-0000-0000-0000-000000000021', '90000000-0000-0000-0000-000000000001', '2026-11-15', 100)$$,
  'B cannot pay A''s debt');
select pg_temp.expect_affected(
  $$update public.money_entries set amount = 1$$, 0, 'B cannot change A''s money entries');
select pg_temp.expect_error(
  $$insert into public.money_entries (id, section_id, kind, day, amount)
    values ('80000000-0000-0000-0000-000000000021', '80000000-0000-0000-0000-000000000001',
      'spend', '2026-11-17', 100)$$,
  'B cannot spend from A''s section');
select pg_temp.expect_affected(
  $$update public.todos set done = true$$, 0, 'B cannot tick off A''s to-dos');
select pg_temp.expect_error(
  $$insert into public.bad_habit_checkins (id, habit_id, day, status)
    values ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000001', '2026-11-18', 'slipped')$$,
  'B cannot check in on A''s bad habit');

-- Signed-out visitors have no access at all.
select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
select pg_temp.expect_error($$select 1 from public.skills$$, 'anon cannot read skills');
select pg_temp.expect_error($$select 1 from public.library_items$$, 'anon cannot read the library');
select pg_temp.expect_error($$select 1 from public.domains$$, 'anon cannot read domains');
select pg_temp.expect_error($$select 1 from public.bad_habit_checkins$$, 'anon cannot read check-ins');
select pg_temp.expect_error($$select 1 from public.todos$$, 'anon cannot read to-dos');
select pg_temp.expect_error($$select 1 from public.money_entries$$, 'anon cannot read money entries');
select pg_temp.expect_error($$select 1 from public.money_debts$$, 'anon cannot read debts');
select pg_temp.expect_error($$select public.delete_account()$$, 'anon cannot call delete_account');

-- Deleting an account removes only that user's data.
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000b');
select public.delete_account();
reset role;
select pg_temp.expect_count('select 1 from auth.users', 1, 'only B was deleted');
select pg_temp.expect_count('select 1 from public.sessions', 1, 'A''s session survives');

select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a');
select public.delete_account();
reset role;
select pg_temp.expect_count('select 1 from public.skills', 0, 'A''s data is removed with the account');
select pg_temp.expect_count('select 1 from public.library_items', 0, 'A''s library is removed with the account');
select pg_temp.expect_count('select 1 from public.domains', 0, 'A''s domains are removed with the account');
select pg_temp.expect_count('select 1 from public.bad_habit_checkins', 0, 'A''s check-ins are removed with the account');
select pg_temp.expect_count('select 1 from public.todos', 0, 'A''s to-dos are removed with the account');
select pg_temp.expect_count('select 1 from public.money_entries', 0, 'A''s money is removed with the account');
select pg_temp.expect_count('select 1 from public.money_debts', 0, 'A''s debts are removed with the account');

rollback;
