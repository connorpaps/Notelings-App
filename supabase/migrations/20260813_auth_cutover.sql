-- Notelings production hardening: authenticated ownership cutover.
--
-- Run only after 20260812_auth_ownership.sql, a verified Supabase backup, and
-- an explicit owner backfill. The transaction aborts if any legacy row still
-- lacks an owner, so it cannot silently hide existing notes.
--
-- Replace the commented bootstrap example in your reviewed deployment process
-- with the real owner's UUID; never accept it from the browser:
-- update public.notes set user_id = '<OWNER_UUID>' where user_id is null;

begin;

do $$
begin
  if exists (select 1 from public.notes where user_id is null) then
    raise exception 'Auth cutover blocked: notes.user_id backfill is incomplete';
  end if;
end $$;

alter table public.notes enable row level security;

drop policy if exists "notes_single_user_all" on public.notes;
drop policy if exists "notes_anon_read" on public.notes;
drop policy if exists notes_authenticated_read on public.notes;
drop policy if exists notes_authenticated_insert on public.notes;
drop policy if exists notes_authenticated_update on public.notes;
drop policy if exists notes_authenticated_delete on public.notes;

create policy notes_authenticated_read on public.notes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notes_authenticated_insert on public.notes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy notes_authenticated_update on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notes_authenticated_delete on public.notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.notes alter column user_id set not null;

commit;
