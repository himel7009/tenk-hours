-- Twelve named colours instead of six, plus any custom colour written as a
-- lowercase six-digit hex code such as #1f8a70.

alter table public.skills drop constraint skills_color_check;
alter table public.skills add constraint skills_color_check check (
  color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose',
            'gold', 'indigo', 'olive', 'fuchsia', 'sky', 'cocoa')
  or color ~ '^#[0-9a-f]{6}$'
);

alter table public.domains drop constraint domains_color_check;
alter table public.domains add constraint domains_color_check check (
  color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose',
            'gold', 'indigo', 'olive', 'fuchsia', 'sky', 'cocoa')
  or color ~ '^#[0-9a-f]{6}$'
);

alter table public.bad_habits drop constraint bad_habits_color_check;
alter table public.bad_habits add constraint bad_habits_color_check check (
  color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose',
            'gold', 'indigo', 'olive', 'fuchsia', 'sky', 'cocoa')
  or color ~ '^#[0-9a-f]{6}$'
);

alter table public.money_sections drop constraint money_sections_color_check;
alter table public.money_sections add constraint money_sections_color_check check (
  color in ('cobalt', 'persimmon', 'moss', 'plum', 'teal', 'rose',
            'gold', 'indigo', 'olive', 'fuchsia', 'sky', 'cocoa')
  or color ~ '^#[0-9a-f]{6}$'
);
