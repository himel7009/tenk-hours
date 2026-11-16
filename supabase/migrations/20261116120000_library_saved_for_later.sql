-- Library: a "saved for later" status for books and courses someone wants
-- to take up in the future, alongside in progress, paused and finished.
--
-- Apply this before deploying the app version that writes this status.

alter table public.library_items
  drop constraint library_items_status_check,
  add constraint library_items_status_check
    check (status in ('planned', 'active', 'paused', 'done'));
