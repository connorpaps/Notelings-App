-- Notelings: username/password auth support (additive).
--
-- Requires 20260812_auth_ownership.sql (the notes.user_id column). Run in the
-- same maintenance window as 20260813_auth_cutover.sql. The username is a
-- login alias resolved to the account's email at sign-in; email remains the
-- canonical Supabase identifier so password hashing, recovery, and session
-- handling stay on Supabase's native, reviewed path.

create table if not exists public.usernames (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on the normalized (lowercased) username. Code
-- normalizes with toLowerCase() before insert/lookup; this index is the
-- database-level guarantee.
create unique index if not exists usernames_username_lower_idx
  on public.usernames (lower(username));

-- FK column index (cascade deletes from auth.users stay fast).
create index if not exists usernames_user_id_idx on public.usernames(user_id);

alter table public.usernames enable row level security;

-- Users can read their own username row. Sign-in resolution runs through the
-- server-only service role, which bypasses RLS. Drop-first keeps the file
-- re-runnable (the setup script may apply it more than once).
drop policy if exists usernames_self_read on public.usernames;
create policy usernames_self_read on public.usernames
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Format guard matching the client/server schema: 3-24 chars, starts with a
-- letter or digit, then letters/digits/dash/underscore.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usernames_username_format'
      and conrelid = 'public.usernames'::regclass
  ) then
    alter table public.usernames add constraint usernames_username_format
      check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$');
  end if;
end $$;
