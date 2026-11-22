-- The routine moves from domains to the trackers in them: each skill or
-- project in a domain takes the domain's weekdays and single-day changes,
-- so nothing it is planned for changes. domains.routine_days, added_days and
-- skipped_days are kept but no longer read by the app.

update public.skills s
set
  routine_days = d.routine_days,
  added_days = array(select distinct x from unnest(d.added_days || s.added_days) as x order by x),
  skipped_days = array(select distinct x from unnest(d.skipped_days || s.skipped_days) as x order by x)
from public.domains d
where s.domain_id = d.id
  and s.deleted_at is null;
