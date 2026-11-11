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

-- Signed-out visitors have no access at all.
select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
select pg_temp.expect_error($$select 1 from public.skills$$, 'anon cannot read skills');
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

rollback;
