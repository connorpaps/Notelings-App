-- Notelings notes table (single-user, no auth).
-- Fresh-install version of the schema (Phase 2 lifecycle).
-- Upgrades for an existing install: supabase/migrations/20260809_phase2.sql
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  category varchar not null default 'Uncategorized',
  tags text[] not null default '{}',
  status varchar not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_created_at_idx on public.notes (created_at desc);

-- Four Phase 2 statuses: pending → in_transit → filed | archived.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_status_check') then
    alter table public.notes add constraint notes_status_check
      check (status in ('pending','in_transit','filed','archived'));
  end if;
end $$;

-- Single-user MVP: no auth exists, so RLS is enabled with one permissive
-- policy. Server writes use the service-role key and bypass RLS; tighten
-- this policy when authentication lands.
alter table public.notes enable row level security;

create policy "notes_single_user_all" on public.notes
  for all to anon
  using (true)
  with check (true);

-- Realtime: publication membership + full-row DELETE payloads.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes') then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
alter table public.notes replica identity full;
