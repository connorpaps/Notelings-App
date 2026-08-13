-- Notelings production hardening: additive ownership preparation.
--
-- STAGING/CUTOVER REQUIREMENTS:
-- 1. Back up/export the database and verify restore before applying.
-- 2. Apply this additive migration in staging and test the two-user matrix.
-- 3. Create the first private owner account and run the reviewed privileged
--    backfill before applying 20260813_auth_cutover.sql.
-- 4. Do not treat this file alone as the security cutover: legacy anonymous
--    SELECT remains until the backfill and atomic cutover are verified.

alter table public.notes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.notes
  add column if not exists client_submission_id text;

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_user_status_created_idx
  on public.notes(user_id, status, created_at desc, id asc);

create unique index if not exists notes_user_submission_unique
  on public.notes(user_id, client_submission_id)
  where client_submission_id is not null;
