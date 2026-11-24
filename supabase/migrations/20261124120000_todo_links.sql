-- An optional link on a to-do: a video or resource to open. Empty for none.
-- Only http and https, as for library items; the app checks the same.

alter table public.todos
  add column url text not null default ''
  check (url = '' or (url ~* '^https?://' and char_length(url) <= 2000));
