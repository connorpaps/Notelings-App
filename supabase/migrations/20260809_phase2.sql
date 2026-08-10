-- Phase 2: SAMS Control Center — notes table upgrades.
-- Run ONCE in the Supabase Dashboard → SQL Editor. Idempotent.
-- (schema.sql keeps the fresh-install version of the same shape.)

-- 1. Track edit/status-change time.
alter table public.notes add column if not exists updated_at timestamptz not null default now();

-- 2. Legacy 'categorized' (M4 creation-time marker) → 'filed' per user decision:
--    existing notes are treated as already delivered (steady state).
update public.notes set status = 'filed' where status = 'categorized';
alter table public.notes alter column status set default 'pending';

-- 3. Constrain the four Phase 2 statuses (pending → in_transit → filed | archived).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_status_check') then
    alter table public.notes add constraint notes_status_check
      check (status in ('pending','in_transit','filed','archived'));
  end if;
end $$;

-- 4. Realtime: the notes table must be in the publication for postgres_changes,
--    and DELETE payloads should carry the full row for the terminal log.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes') then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
alter table public.notes replica identity full;
