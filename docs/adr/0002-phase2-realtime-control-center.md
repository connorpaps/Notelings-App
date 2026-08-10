# ADR-0002: Phase 2 real-time control center (Kanban, Terminal, CRUD)

- **Date:** 2026-08-09
- **Status:** Accepted (user-approved during Phase 2 planning)

## Context

Phase 1 (M4) shipped the "Write" engine: notes → LLM → Supabase → robot delivery. Phase 2 adds the "Read & Think" engine: a live Kanban (Pending / In Transit / Filed), a monospace Terminal, and full note management (edit, archive, agentic delete). The spec (PHASE_2_SPEC_FINAL) demands Realtime (`supabase.channel().on('postgres_changes')`, NOT polling) with StrictMode-safe channel cleanup.

## Decisions

### 1. Writes stay server-side; the anon key is read-only Realtime
New routes `GET /api/notes`, `PATCH /api/notes/[id]` (content/tags/status), `DELETE /api/notes/[id]` all use the service-role key (`lib/supabase/server.ts`, `server-only`) — ADR-0001's single-write-path discipline holds. The browser client (`lib/supabase/client.ts`, anon key) is used **only** for the Realtime channel subscription. All writes are zod-validated (`lib/notes/notesApi.ts`).

### 2. Status lifecycle: pending → in_transit → filed | archived
`POST /api/categorize` now inserts `status: 'pending'`. A client hook (`useNoteSync`) pushes robot lifecycle to the DB: dispatch → `in_transit` (after a deliberate 1.5s "Pending beat" so the board visibly reads Pending → In Transit → Filed), delivery completion → `filed`, archive disposal → `archived`. Failures are caught and logged to the terminal — never thrown, so the 3D loop can't break offline.

### 3. Soft archive (user decision) + legacy rows → filed
Archiving sets `status='archived'` (row kept, restorable). An "Archived" toggle shows archived notes with Restore (→ `filed`) and Delete forever (hard DELETE). The 15 legacy `categorized` rows migrated to `filed` (existing delivered notes = steady state). Migration: `supabase/migrations/20260809_phase2.sql` (adds `updated_at`, status CHECK constraint, realtime publication membership, `replica identity full` for full-row DELETE payloads).

### 4. Agentic delete = a two-leg archive task on the existing motor
The robot motor stays single-target; the archive flow chains two commands in the store: leg 1 `archive` → walk to the note's category destination → `processing` beat (the "pickup", where the carried note card appears) → `completeArchiveStage` → leg 2 `archive-final` → walk to the trash staging cell `[29,24]` (bound to the locked `Misc Trashcan Small 03`) → `arriveArchiveFinal` → idle + `archivedTasks` log. Archive completion never touches `completeTask`, so it can never emit the delivery toast (unit-tested).

### 5. Fetch/realtime race hardening
`setNotes` MERGES newest-wins by `updated_at` instead of replacing: the initial GET snapshot can resolve after realtime events for a freshly submitted note (cold-route latency) and a replace would erase its Pending/In Transit cards — the reported M1 bug. Verified live before closing.

### 6. Terminal state management
Event log lives in Zustand, capped at 100 via a pure `appendLog` helper (`lib/notes/terminalLogs.ts`). The store stays UI-free (log lines are plain strings; the Terminal renders them monospace).

## Consequences

- The board is a true live control center: every status change reflects in ~300ms across any open tab.
- RLS stays permissive (single-user MVP); the anon key is now client-visible but read-only by construction — the Realtime socket carries no write grants.
- `replica identity full` slightly increases WAL size for `notes` (trivial at this scale) in exchange for full-row DELETE payloads.
- Pending is intentionally visible for ~1.5s before the robot's in_transit beat — a product decision for legibility of the loop.
