-- An optional day to finish a book or course by. Null means no deadline.

alter table public.library_items add column deadline date;
