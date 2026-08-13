-- Notelings notes table (authenticated, owner-scoped).
-- Fresh-install version of the schema (Phase 2 lifecycle + production ownership).
-- Existing single-user installs must use the reviewed migrations in order and
-- complete the owner backfill before removing legacy anonymous access.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_submission_id text,
  content text not null,
  category varchar not null default 'Uncategorized',
  tags text[] not null default '{}',
  status varchar not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_submission_id)
);

-- Work/Admin/Uncategorized are AI outcomes; Manual identifies AI-off capture.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_category_check') then
    alter table public.notes add constraint notes_category_check
      check (category in ('Work','Admin','Uncategorized','Manual'));
  end if;
end $$;

create index if not exists notes_created_at_idx on public.notes (created_at desc);

-- Four Phase 2 statuses: pending → in_transit → filed | archived.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_status_check') then
    alter table public.notes add constraint notes_status_check
      check (status in ('pending','in_transit','filed','archived'));
  end if;
end $$;

-- Authenticated owner-scoped RLS. The browser anon key can establish a
-- session, but it cannot read or write rows without an authenticated owner.
alter table public.notes enable row level security;

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_user_status_created_idx
  on public.notes(user_id, status, created_at desc, id asc);

create policy "notes_authenticated_read" on public.notes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notes_authenticated_insert" on public.notes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notes_authenticated_update" on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notes_authenticated_delete" on public.notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Realtime: publication membership + full-row DELETE payloads.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes') then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
alter table public.notes replica identity full;
