-- Live updates: Supabase Realtime tells a signed-in device the moment one of
-- its rows changes on the server, so the app pulls straight away instead of
-- waiting for its next poll. The notice only prompts a pull; the data still
-- arrives through the normal sync, and Realtime applies each table's row
-- level security, so a user is only told about their own rows.

alter publication supabase_realtime add table
  public.skills,
  public.sessions,
  public.domains,
  public.library_items,
  public.bad_habits,
  public.bad_habit_checkins,
  public.todos;
