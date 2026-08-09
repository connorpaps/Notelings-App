-- Notelings MVP notes table (single-user, no auth). Matches MASTER_SPEC_FINAL §5.A.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  category varchar not null default 'Uncategorized',
  tags text[] not null default '{}',
  status varchar not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists notes_created_at_idx on public.notes (created_at desc);

-- Single-user MVP: no auth exists, so RLS is enabled with one permissive
-- policy. Server writes use the service-role key and bypass RLS; tighten
-- this policy when authentication lands.
alter table public.notes enable row level security;

create policy "notes_single_user_all" on public.notes
  for all to anon
  using (true)
  with check (true);
