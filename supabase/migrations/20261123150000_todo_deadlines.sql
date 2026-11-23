-- An optional deadline for a to-do, separate from the day it is planned for
-- (which moves on by itself). Null means no deadline.

alter table public.todos add column deadline date;
