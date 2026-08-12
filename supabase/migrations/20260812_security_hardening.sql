-- Security hardening 2026-08-12: make the anon role READ-ONLY on `notes`.
--
-- Rationale: every write already flows through server routes using the
-- service-role key (which bypasses RLS), and the browser's anon key is only
-- used for the Realtime `postgres_changes` subscription (read-only). The old
-- permissive policy (`for all to anon using (true) with check (true)`) let any
-- client that has the public anon key INSERT/UPDATE/DELETE notes directly.
-- This migration drops that and leaves anon with SELECT only.
--
-- NOTE: this protects WRITE integrity, not confidentiality. The anon key ships
-- in the browser bundle, so anyone who has it can still SELECT every note
-- (single-user MVP, no auth). Tighten the SELECT policy when authentication
-- lands.
--
-- Run ONCE in the Supabase Dashboard → SQL Editor. Idempotent.

drop policy if exists "notes_single_user_all" on public.notes;
drop policy if exists "notes_anon_read" on public.notes;

create policy "notes_anon_read" on public.notes
  for select to anon
  using (true);
