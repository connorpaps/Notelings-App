-- Notelings: distinguish manual/no-AI capture from AI Uncategorized results.
-- Existing notes retain their current categories; only the allowed-value
-- constraint changes. Re-runnable for local setup scripts and reviewed deploys.

alter table public.notes drop constraint if exists notes_category_check;
alter table public.notes add constraint notes_category_check
  check (category in ('Work', 'Admin', 'Uncategorized', 'Manual'));
