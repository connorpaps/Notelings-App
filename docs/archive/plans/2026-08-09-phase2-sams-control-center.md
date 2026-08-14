# Phase 2 — SAMS Control Center (M1) + Note Management (M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Notelings into a real-time SAMS control center: a live Kanban (Pending / In Transit / Filed) driven by Supabase Realtime, a monospace Terminal dock with the note input embedded, and full note management (edit, soft archive, and a visual "agentic delete" where a robot walks a note to a 3D trash can).

**Architecture:** The existing M4 core loop (single `POST /api/categorize` write path, Zustand task queue, A* robot motor) stays intact. Phase 2 adds: a browser Supabase client used **only** for the Realtime channel (with StrictMode-safe `removeChannel` cleanup), server-side write routes (`GET /api/notes`, `PATCH`/`DELETE /api/notes/[id]`) so all writes keep the service-role discipline, a DB-driven Kanban + Terminal fed by Zustand state, and a chained two-leg "archive" task kind that reuses the existing single-target robot motor. Soft archive: `status='archived'` keeps rows restorable; legacy `categorized` rows migrate to `filed`.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand 5, `@supabase/supabase-js@2` (Realtime `postgres_changes`), zod 4, Tailwind v4 + existing `.liquid-glass`/`.liquid-glass-strong`, framer-motion, lucide-react, react-hook-form, sonner, Vitest, Playwright. No new npm packages.

## Global Constraints

- **Aesthetic (PHASE_2_SPEC §2):** overlays at `z-20`, 3D office stays `z-10` passive (no click events on meshes), strict grayscale text (`text-white/80/50`), Poppins body + Source Serif 4 italic accents, `hover:scale-105` + Lucide icons in `bg-white/10` circles. Only robot-color identity dots are colored (blue `#2fa8e0`, green `#43c98b`, red `#ef4444`).
- **Accessible names preserved (E2E contract):** `Initialize Agents`, `Type a new note`, `Submit note`; toast copy `Success: <Agent> filed your note in <Category>.` unchanged; single `<h1>`.
- **Realtime rule (PHASE_2_SPEC §5):** `useEffect` MUST return cleanup calling `supabase.removeChannel(channel)` — zombie channels crash under StrictMode.
- **Terminal cap:** event log capped at 100 entries (never unbounded).
- **R3F rule:** never `unmountComponentAtNode`, never manual Three.js dispose; shared geometry only; let R3F unmount naturally.
- **Writes stay server-side:** client anon key is used ONLY for the Realtime subscription. All DB writes go through server routes with the service-role key (`lib/supabase/server.ts`, `server-only`).
- **Dispatch roster unchanged:** blue/green only; red is never dispatched. `completeTask`/completions log untouched for note tasks (toast exactly-once).
- **Existing tests must keep passing:** 83 unit tests, 3 E2E (baseline / happy / degraded), render/camera/shadow/profile contracts, robot-part contract (body/face/glow).
- Never commit `.env.local`; no new packages; `npm` only.

## File Structure

**New files**
- `lib/supabase/client.ts` — browser anon client (Realtime only)
- `lib/notes/notesApi.ts` — zod schemas shared by route + client (`NoteStatusSchema`, `NotePatchSchema`, `NoteRecordSchema`, `NotesListSchema`)
- `lib/notes/kanban.ts` — `KANBAN_COLUMNS`, `groupNotesByStatus`, `statusSort` (+ test)
- `lib/notes/terminalLogs.ts` — `TERMINAL_LOG_CAP`, `appendLog`, `truncateContent` (+ test)
- `app/api/notes/route.ts` — GET all notes (service role, `server-only`)
- `app/api/notes/[id]/route.ts` — PATCH (content/tags/status) + DELETE
- `supabase/migrations/20260809_phase2.sql` — migration the user runs
- `components/notelings/KanbanPanel.tsx`, `KanbanColumn.tsx`, `NoteCard.tsx`
- `components/notelings/TerminalDock.tsx`, `TerminalLog.tsx`
- `components/notelings/GlassModal.tsx`, `NoteEditModal.tsx`
- `components/notelings/useNotesRealtime.ts`, `useNoteSync.ts`
- `docs/adr/0002-phase2-realtime-control-center.md`

**Modified files**
- `lib/notes/types.ts` — `NoteStatus`, `NoteRecord`
- `components/office/agentStore.ts` — Task `kind`/`noteId`/`finalDestination`; `notes` + `terminalLogs` + `archivingNoteIds` state; archive state-machine actions; `archivedTasks` log; `resetForTests` clears new state
- `components/office/AgentRobot.tsx` — archive targetKinds arrival branch, processing branch, `robot-note` card mesh
- `components/office/agentDestinations.ts` — `TRASH_STAGING_CELL`, `TRASH_LOCKED_ITEM_ID/ASSET_ID` (+ test)
- `components/notelings/NotelingsUI.tsx` — mount `useNotesRealtime` + `useNoteSync`, swap right panel → Kanban, bottom → TerminalDock, mobile kanban toggle
- `components/notelings/CommandDock.tsx` — `embedded` prop (drop absolute positioning when inside TerminalDock)
- `components/notelings/completionToasts.ts` — `archiveToastMessage` (+ test), `TaskCompletion.noteId` passthrough
- `app/api/categorize/route.ts` — write `status: 'pending'` instead of `'categorized'`
- `supabase/schema.sql` — sync with migration
- `app/globals.css` — terminal log + kanban scrollbar styling (grayscale)
- `e2e/office-smoke.spec.ts` — mock `**/api/notes/**`; kanban/terminal/robot-note assertions; archive E2E

## Global Interfaces (locked early — every task references these)

```ts
// lib/notes/types.ts
export type NoteStatus = 'pending' | 'in_transit' | 'filed' | 'archived'
export type NoteRecord = {
  id: string
  content: string
  category: NoteCategory
  tags: string[]
  status: NoteStatus
  created_at: string
  updated_at?: string | null
}
```

```ts
// lib/notes/notesApi.ts
export const NoteStatusSchema = z.enum(['pending', 'in_transit', 'filed', 'archived'])
export const NotePatchSchema = z
  .object({
    content: z.string().trim().min(1).max(NOTE_CONTENT_MAX).optional(),
    tags: z.array(z.string().min(1).max(40)).max(5).optional(),
    status: NoteStatusSchema.optional(),
  })
  .refine((v) => v.content !== undefined || v.tags !== undefined || v.status !== undefined, {
    message: 'At least one field to update is required',
  })
export const NoteRecordSchema = z.object({
  id: z.string(),
  content: z.string(),
  category: z.enum(['Work', 'Admin', 'Uncategorized']),
  tags: z.array(z.string()),
  status: NoteStatusSchema,
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
})
export const NotesListSchema = z.array(NoteRecordSchema)
```

```ts
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Missing Supabase browser environment variables')
  return createClient(url, anonKey, { auth: { persistSession: false } })
}
```

```ts
// components/office/agentStore.ts — additions
export type TaskKind = 'note' | 'archive'
export type Task = {
  id: string
  kind: TaskKind
  noteId?: string
  destination: TaskDestination
  finalDestination?: GridCell // archive only
  content: string
  category: NoteCategory
  tags: string[]
  createdAt: number
}
export type TerminalLog = { id: string; ts: number; level: 'info' | 'success' | 'error'; message: string }
export type AgentCommandKind = 'task' | 'wander' | 'archive' | 'archive-final' | null
// TaskCompletion gains: noteId?: string; kind: TaskKind  (kind defaults 'note')

// New state: notes: Record<string, NoteRecord>; terminalLogs: TerminalLog[]; archivingNoteIds: string[]; archivedTasks: TaskCompletion[]
// New actions:
// setNotes(notes: NoteRecord[]): void
// upsertNote(note: NoteRecord): void
// removeNote(id: string): void
// logTerminal(message: string, level?: TerminalLog['level']): void
// markNoteArchiving(noteId: string): void
// enqueueArchive(input: { noteId: string; category: NoteCategory; content: string; tags: string[] }): string
// arriveArchiveStage(agentId: AgentId): boolean
// completeArchiveStage(agentId: AgentId): boolean
// arriveArchiveFinal(agentId: AgentId): boolean
```

```ts
// components/office/agentDestinations.ts — additions
export const TRASH_STAGING_CELL: GridCell = [29, 24]
export const TRASH_LOCKED_ITEM_ID = 'asset:misc-trashcans-off-ad2d51bd'
export const TRASH_LOCKED_ASSET_ID = 'asset:misc-trashcans-office-misc-trashcan-small-03'
// validated against LOCKED_DEFAULT_ITEMS like the other destinations
```

```ts
// lib/notes/kanban.ts
export const KANBAN_COLUMNS = [
  { key: 'pending', label: 'Pending', hint: 'Awaiting pickup' },
  { key: 'in_transit', label: 'In Transit', hint: 'Robot on the move' },
  { key: 'filed', label: 'Filed', hint: 'Delivered' },
] as const
export function groupNotesByStatus(notes: readonly NoteRecord[]): Record<'pending' | 'in_transit' | 'filed', NoteRecord[]>
export function statusSort(a: NoteRecord, b: NoteRecord): number // created_at desc
```

```ts
// lib/notes/terminalLogs.ts
export const TERMINAL_LOG_CAP = 100
export function appendLog(logs: readonly TerminalLog[], entry: { message: string; level?: TerminalLog['level'] }, cap?: number): TerminalLog[]
export function truncateContent(content: string, max?: number): string // default 48, ellipsis
```

```ts
// components/office/agentDestinations.ts — TRASH constants + agentStore archive machine:
// enqueueArchive → task { kind:'archive', destination: categoryToDestination(category), finalDestination: TRASH_STAGING_CELL, noteId }
// dispatchAvailableTasks: archive task → target = task.destination, targetKind = 'archive' (red still never dispatched)
// arriveArchiveStage: walking + targetKind 'archive' → processing (pickup), processingStartedAt
// completeArchiveStage: processing + task.kind 'archive' → walking, target = finalDestination, targetKind 'archive-final'
// arriveArchiveFinal: walking + targetKind 'archive-final' → idle, clear task, push archivedTasks, remove archivingNoteIds entry
```

---

# MILESTONE 1 — SAMS Control Center

### Task 1: DB migration + browser Supabase client

**Files:**
- Create: `supabase/migrations/20260809_phase2.sql`
- Modify: `supabase/schema.sql`
- Create: `lib/supabase/client.ts`

**Interfaces:**
- Consumes: existing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produces: `createBrowserSupabase(): SupabaseClient` (used by Task 7)

- [ ] **Step 1: Write the migration**

```sql
-- Phase 2: notes table upgrades (run once in the Supabase SQL editor)
alter table public.notes add column if not exists updated_at timestamptz not null default now();

-- Legacy 'categorized' (creation-time marker from M4) → 'filed' per user decision.
update public.notes set status = 'filed' where status = 'categorized';
alter table public.notes alter column status set default 'pending';

-- Constrain the four Phase 2 statuses (idempotent).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_status_check') then
    alter table public.notes add constraint notes_status_check
      check (status in ('pending','in_transit','filed','archived'));
  end if;
end $$;

-- Realtime: ensure the notes table is in the publication + DELETE payloads carry full rows.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes') then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
alter table public.notes replica identity full;
```

- [ ] **Step 2: Sync `supabase/schema.sql`** to the same final shape (status default `'pending'`, `updated_at`, check constraint, publication DO block, replica identity full).
- [ ] **Step 3: PAUSE — ask the user to run `supabase/migrations/20260809_phase2.sql` in the Supabase Dashboard SQL editor.** Do not continue until confirmed.
- [ ] **Step 4: Implement `lib/supabase/client.ts`** exactly per the Global Interfaces block.
- [ ] **Step 5: Verify** `npx tsc --noEmit` passes; confirm migration ran: `node` one-liner via `@supabase/supabase-js` service-role client selecting `updated_at` from notes (expect rows present).
- [ ] **Step 6: Commit** — `git add supabase lib/supabase && git commit -m "feat: phase2 notes migration + browser supabase client"`

### Task 2: Domain types + categorize route status

**Files:**
- Modify: `lib/notes/types.ts`
- Modify: `app/api/categorize/route.ts`

**Interfaces:**
- Produces: `NoteStatus`, `NoteRecord` (consumed by Tasks 3–4, kanban, hooks)

- [ ] **Step 1: Add `NoteStatus` + `NoteRecord`** to `lib/notes/types.ts` per Global Interfaces (module stays scene-free).
- [ ] **Step 2: Change the route insert** in `app/api/categorize/route.ts` from `status: degraded ? 'pending' : 'categorized'` to `status: 'pending'` (success and degraded both start in Pending; the LLM outcome is carried by `category`).
- [ ] **Step 3: Verify** `npx tsc --noEmit`; existing tests still pass (`npm test`).
- [ ] **Step 4: Commit** — `feat: add note status domain types; categorize route writes pending`

### Task 3: Server notes routes (GET / PATCH / DELETE)

**Files:**
- Create: `app/api/notes/route.ts`
- Create: `app/api/notes/[id]/route.ts`
- Create: `lib/notes/notesApi.ts`

**Interfaces:**
- Consumes: `createServerSupabase()` (existing), `NoteRecord`/`NoteStatus` from Task 2
- Produces: `GET /api/notes → NoteRecord[]`; `PATCH /api/notes/[id] {content?, tags?, status?} → NoteRecord`; `DELETE /api/notes/[id] → {ok: true}`

- [ ] **Step 1: Implement `lib/notes/notesApi.ts`** zod schemas per Global Interfaces (client-safe module — no `server-only`).
- [ ] **Step 2: `app/api/notes/route.ts`** — `runtime: 'nodejs'`; GET: `createServerSupabase().from('notes').select('*').order('created_at', { ascending: false })`; parse with `NotesListSchema`; errors → 500 `{ error: 'Could not load notes' }`.
- [ ] **Step 3: `app/api/notes/[id]/route.ts`** — `runtime: 'nodejs'`; `params` awaited (Next 16); PATCH: `NotePatchSchema.parse` → `.update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single()`; 404 if no row; DELETE: `.delete().eq('id', id)`; 404 if no row; zod failure → 400.
- [ ] **Step 4: Smoke test** — dev server running: `curl -s http://localhost:3000/api/notes | head -c 300` (expect JSON array); `curl -s -X PATCH http://localhost:3000/api/notes/<real-id> -H 'Content-Type: application/json' -d '{"status":"filed"}'` then restore with the same id → `"status":"filed"` in response. Do NOT modify content during smoke test.
- [ ] **Step 5: Commit** — `feat: add notes read/update/delete routes`

### Task 4: Store — notes, terminal log, archive state machine

**Files:**
- Modify: `components/office/agentStore.ts`
- Test: `components/office/agentStore.test.ts`

**Interfaces:**
- Consumes: `NoteRecord` (Task 2), `TRASH_STAGING_CELL` (Task 5), `categoryToDestination` (existing)
- Produces: all Global-Interfaces store additions; consumed by Tasks 7–10 and M2

- [ ] **Step 1: Write failing tests** (append to `agentStore.test.ts`) — pin the new behavior:

```ts
it('carries the DB note id through enqueueTask and dispatch', () => {
  const id = useAgentStore.getState().enqueueTask({ ...task('whiteboard'), noteId: 'note-1' })
  useAgentStore.getState().dispatchAvailableTasks()
  expect(useAgentStore.getState().agents.blue.currentTask?.noteId).toBe('note-1')
  useAgentStore.getState().arriveAtTask('blue')
  useAgentStore.getState().completeTask('blue')
  expect(useAgentStore.getState().completions[0].noteId).toBe('note-1')
  expect(useAgentStore.getState().completions[0].kind).toBe('note')
})

it('keeps notes and terminal logs in state with a 100-entry cap', () => {
  const store = useAgentStore.getState()
  store.setNotes([{ id: 'n1', content: 'hi', category: 'Work', tags: [], status: 'pending', created_at: new Date().toISOString() }])
  expect(useAgentStore.getState().notes.n1.status).toBe('pending')
  for (let i = 0; i < 120; i += 1) useAgentStore.getState().logTerminal(`line ${i}`)
  expect(useAgentStore.getState().terminalLogs).toHaveLength(100)
  expect(useAgentStore.getState().terminalLogs[99].message).toBe('line 119')
  store.upsertNote({ ...useAgentStore.getState().notes.n1, status: 'filed' })
  store.removeNote('n1')
  expect(useAgentStore.getState().notes.n1).toBeUndefined()
})

it('runs the archive state machine without emitting a delivery completion', () => {
  useAgentStore.getState().markNoteArchiving('note-a')
  expect(useAgentStore.getState().archivingNoteIds).toContain('note-a')
  useAgentStore.getState().enqueueArchive({ noteId: 'note-a', category: 'Work', content: 'old idea', tags: [] })
  useAgentStore.getState().dispatchAvailableTasks()
  const walking = useAgentStore.getState().agents.blue
  expect(walking.targetKind).toBe('archive')
  expect(walking.target).toEqual(TASK_DESTINATIONS.whiteboard)
  expect(useAgentStore.getState().arriveArchiveStage('blue')).toBe(true)
  expect(useAgentStore.getState().agents.blue.status).toBe('processing')
  expect(useAgentStore.getState().completeArchiveStage('blue')).toBe(true)
  expect(useAgentStore.getState().agents.blue.targetKind).toBe('archive-final')
  expect(useAgentStore.getState().agents.blue.target).toEqual([29, 24])
  expect(useAgentStore.getState().arriveArchiveFinal('blue')).toBe(true)
  expect(useAgentStore.getState().agents.blue.status).toBe('idle')
  expect(useAgentStore.getState().agents.blue.currentTask).toBeNull()
  expect(useAgentStore.getState().archivingNoteIds).not.toContain('note-a')
  expect(useAgentStore.getState().completions).toEqual([]) // no false delivery toast
  expect(useAgentStore.getState().archivedTasks).toHaveLength(1)
  expect(useAgentStore.getState().archivedTasks[0].noteId).toBe('note-a')
})
```

- [ ] **Step 2: Run** `npx vitest run agentStore` — expect the three new tests to FAIL.
- [ ] **Step 3: Implement** store additions:
  - `Task` gains `kind: 'note'` default, `noteId?`, `finalDestination?`; `EnqueueTaskInput` gains `noteId?`; `enqueueTask` spreads it; `TaskCompletion` gains `kind` + `noteId?`; `completeTask` copies `kind`/`noteId` from the task.
  - `AgentCommandKind` union extended; `dispatchAvailableTasks` chooses `targetKind = task.kind === 'archive' ? 'archive' : 'task'`.
  - New state `notes`, `terminalLogs`, `archivingNoteIds`, `archivedTasks` + actions `setNotes`, `upsertNote`, `removeNote`, `logTerminal` (uses `appendLog` with `TERMINAL_LOG_CAP`), `markNoteArchiving`, `enqueueArchive`, `arriveArchiveStage`, `completeArchiveStage`, `arriveArchiveFinal` per the archive machine in Global Interfaces.
  - **Terminal logging inside existing actions** (pure state, no fetch): `enqueueTask` → `logTerminal(\`Note queued: "${truncateContent(content)}"\`)`; dispatch assignment → `logTerminal(\`${AGENT_DISPLAY_NAMES[id]} dispatched: "${truncateContent(task.content)}" → ${TASK_DESTINATION_LABELS[task.destination]}\`)`; `completeTask` → `logTerminal(\`${AGENT_DISPLAY_NAMES[agentId]} filed "${truncateContent(...)}" in ${task.category}.\`)`; `arriveArchiveStage` → `logTerminal(\`${AGENT_DISPLAY_NAMES[agentId]} picking up "${truncateContent(...)}" for archive…\`)`; `arriveArchiveFinal` → `logTerminal(\`${AGENT_DISPLAY_NAMES[agentId]} archived "${truncateContent(...)}".\`)`. Import `truncateContent` from `lib/notes/terminalLogs` and `AGENT_DISPLAY_NAMES` from `components/notelings/completionToasts` (store stays UI-free: these are strings only — verify no react import leaks into `agentStore.ts`; `completionToasts.ts` is pure).
  - `resetForTests` clears `notes`, `terminalLogs`, `archivingNoteIds`, `archivedTasks`.
- [ ] **Step 4: Run** `npx vitest run` — new tests pass; all pre-existing store tests still pass (FIFO/roster/red/completions unchanged).
- [ ] **Step 5: Commit** — `feat: store notes, terminal log, and archive task machine`

### Task 5: Trash destination binding

**Files:**
- Modify: `components/office/agentDestinations.ts`
- Test: `components/office/agentDestinations.test.ts`

**Interfaces:**
- Produces: `TRASH_STAGING_CELL = [29, 24]` (validated free + reachable, adjacent to locked `Misc Trashcan Small 03` at cell `[30,25]`)

- [ ] **Step 1: Write failing tests** (append):

```ts
it('binds the trash destination to the locked trash can and a free reachable staging cell', () => {
  const blocked = buildAgentBlockedCells()
  expect(TRASH_LOCKED_ITEM_ID).toBe('asset:misc-trashcans-off-ad2d51bd')
  expect(TRASH_LOCKED_ASSET_ID).toBe('asset:misc-trashcans-office-misc-trashcan-small-03')
  const item = LOCKED_DEFAULT_ITEMS.find((i) => i.id === TRASH_LOCKED_ITEM_ID)
  expect(item).toBeDefined()
  expect(item!.assetId).toBe(TRASH_LOCKED_ASSET_ID)
  const [col, row] = TRASH_STAGING_CELL
  expect(col).toBeGreaterThanOrEqual(0)
  expect(col).toBeLessThan(AGENT_GRID_COLS)
  expect(row).toBeGreaterThanOrEqual(0)
  expect(row).toBeLessThan(AGENT_GRID_ROWS)
  expect(blocked.has(`${col},${row}`)).toBe(false)
  expect(findPath(AGENT_START_CELL, TRASH_STAGING_CELL, { blocked, cols: AGENT_GRID_COLS, rows: AGENT_GRID_ROWS })).not.toBeNull()
  const itemCell = worldToGridCell(item!.transform.position[0], item!.transform.position[2], AGENT_GRID_TRANSFORM)
  expect(Math.hypot(col - itemCell[0], row - itemCell[1])).toBeLessThanOrEqual(1.5)
})
```

- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** — constants + locked-item validation throw (mirror the existing Whiteboard/Corkboard pattern).
- [ ] **Step 4: Run** `npx vitest run agentDestinations` — pass.
- [ ] **Step 5: Commit** — `feat: bind trash staging cell to the locked trash can`

### Task 6: Pure helpers — kanban grouping + terminal log

**Files:**
- Create: `lib/notes/kanban.ts` + `lib/notes/kanban.test.ts`
- Create: `lib/notes/terminalLogs.ts` + `lib/notes/terminalLogs.test.ts`

**Interfaces:**
- Produces: `KANBAN_COLUMNS`, `groupNotesByStatus`, `statusSort`, `appendLog`, `truncateContent`, `TERMINAL_LOG_CAP`

- [ ] **Step 1: Write tests first** — cover: grouping drops `archived`, orders `created_at` desc (ties broken by id), each column key exists; `appendLog` caps at 100 and drops oldest; `truncateContent` keeps ≤48 chars with `…`.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** both modules (exact signatures in Global Interfaces).
- [ ] **Step 4: Run** `npx vitest run kanban terminalLogs` — pass.
- [ ] **Step 5: Commit** — `feat: kanban grouping + terminal log helpers`

### Task 7: Realtime subscription hook

**Files:**
- Create: `components/notelings/useNotesRealtime.ts`

**Interfaces:**
- Consumes: `createBrowserSupabase()` (Task 1), `NoteRecord` (Task 2), store `setNotes/upsertNote/removeNote/logTerminal`
- Produces: nothing (side-effect hook); consumed by Task 10 (mounted in `NotelingsUI`)

- [ ] **Step 1: Implement** — one `useEffect([])`:
  1. **Initial fetch:** `fetch('/api/notes')` → `NotesListSchema` → `setNotes` + `logTerminal(\`Loaded ${n} notes.\`)`; catch → `logTerminal('Could not load notes from server.', 'error')`. Guard with a `disposed` flag.
  2. **Realtime:** `const sb = createBrowserSupabase()` inside try/catch (missing env → `logTerminal('Realtime unavailable (missing env).', 'error')` and return). `const channel = sb.channel('notes-kanban')` with three `.on('postgres_changes', ...)` handlers (INSERT/UPDATE → `upsertNote(payload.new as NoteRecord)`; DELETE → `removeNote(String(payload.old.id))`) then `.subscribe((status) => { if (status === 'SUBSCRIBED') logTerminal('Realtime connected — live sync on.'); if (status === 'CHANNEL_ERROR') logTerminal('Realtime channel error.', 'error') })`.
  3. **CRITICAL cleanup (spec §5):** `return () => { disposed = true; if (channel && sb) void sb.removeChannel(channel) }`.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`. Manual: open the app in Chrome devtools → Network WS tab shows the realtime socket; console shows the connect log. Then in the Supabase dashboard insert a row → it appears in the store (verify via `window` debug or the Kanban in Task 8). StrictMode dev: confirm only ONE active channel in the WS list after mount (cleanup works).
- [ ] **Step 3: Commit** — `feat: realtime notes subscription with strict-mode-safe cleanup`

### Task 8: Kanban panel (read-only M1)

**Files:**
- Create: `components/notelings/KanbanPanel.tsx`, `KanbanColumn.tsx`, `NoteCard.tsx`

**Interfaces:**
- Consumes: store `notes`, `archivingNoteIds`, `groupNotesByStatus`, `KANBAN_COLUMNS`, `GlassPanel`
- Produces: `KanbanPanel` (replaces `TaskQueuePanel` in `NotelingsUI`); `NoteCard` with `onEdit?`/`onArchive?` props (wired in M2)

- [ ] **Step 1: `NoteCard.tsx`** — `.liquid-glass` card: content truncated 2 lines, category label (`Work`/`Admin`/`Uncategorized`), tag chips (max 3, `#` prefix, `text-white/50`), relative timestamp (`x min ago`), robot-color dot per status (pending white, in_transit blue, filed green). While `archiving` → subtle pulse via framer-motion + "Archiving…" label. Empty `onEdit`/`onArchive` props → render no buttons yet.
- [ ] **Step 2: `KanbanColumn.tsx`** — header (`label` + count badge `bg-white/10`), scrollable list (`max-h-[52vh] overflow-y-auto`), `AnimatePresence` entrance/exit.
- [ ] **Step 3: `KanbanPanel.tsx`** — `GlassPanel glow rounded-[2rem] w-[320px]`; serif-italic accent heading "Spatial **Board**" (single h2); three columns in a horizontal row (`flex gap-3`); empty state per column ("Quiet."); reads `useAgentStore((s) => s.notes)` + `archivingNoteIds`; groups via `groupNotesByStatus`.
- [ ] **Step 4: Wire into `NotelingsUI`** — replace `<TaskQueuePanel />` with `<KanbanPanel />`; delete `TaskQueuePanel.tsx` (it is only used there — verify no other import).
- [ ] **Step 5: Verify** — `npx tsc --noEmit`; `npm test`; browser: 15 live notes appear in Filed with realtime connect log.
- [ ] **Step 6: Commit** — `feat: realtime kanban panel (pending/in-transit/filed)`

### Task 9: Terminal dock (input + event log)

**Files:**
- Create: `components/notelings/TerminalDock.tsx`, `TerminalLog.tsx`
- Modify: `components/notelings/CommandDock.tsx`, `components/notelings/NotelingsUI.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: store `terminalLogs`; existing `CommandDock`
- Produces: `TerminalDock` (bottom bar embedding `CommandDock` + `TerminalLog`)

- [ ] **Step 1: `CommandDock.tsx`** — accept `embedded?: boolean`; when true, drop `absolute bottom-8 left-1/2 -translate-x-1/2 z-30 w-[min(600px,...)]` for `w-full`. Accessible names unchanged.
- [ ] **Step 2: `TerminalLog.tsx`** — monospace log (`font-mono text-[11px] leading-relaxed`): level dot (info `bg-white/40`, success `bg-white/70`, error `bg-red-400/80` — the only color allowed is the error identity cue), `truncateContent` not applied (log lines are short by construction), auto-scroll to bottom on new entries (`useRef` + `scrollTop = scrollHeight` inside `useLayoutEffect` on `logs.length`).
- [ ] **Step 3: `TerminalDock.tsx`** — `absolute inset-x-0 bottom-0 z-30 p-4 md:p-6`; `GlassPanel glow rounded-[2rem]`; flex row: `CommandDock embedded` (left, `w-[min(520px,45%)]`) + divider + `TerminalLog` (right, `flex-1 min-w-0`, `max-h-[160px] overflow-y-auto`). On `< md`: log collapses behind a toggle button (`Terminal` + chevron), input stays.
- [ ] **Step 4: `NotelingsUI.tsx`** — replace standalone `<CommandDock />` + keep `<Toaster>`; move mobile kanban toggle into the header (Task 8’s `lg:`-hidden panel opens as a bottom-sheet overlay via AnimatePresence when the toggle is on; same component, `absolute inset-x-3 bottom-24 z-40`).
- [ ] **Step 5: `globals.css`** — `.terminal-log` scrollbar styling (thin, `bg-white/10`) + `scrollbar-gutter` for the kanban columns; grayscale only.
- [ ] **Step 6: Verify** — `npx tsc --noEmit`; browser: typing + submitting still works; log lines appear for queued/dispatched/filed; `Initialize Agents` + `Type a new note` + `Submit note` still present.
- [ ] **Step 7: Commit** — `feat: terminal dock with embedded note input`

### Task 10: Status-sync hook (Pending → In Transit → Filed)

**Files:**
- Create: `components/notelings/useNoteSync.ts`
- Modify: `components/notelings/NotelingsUI.tsx`

**Interfaces:**
- Consumes: store (agents, `completions`, `archivedTasks`), `collectNewCompletions`
- Produces: fire-and-forget `PATCH /api/notes/:id {status}` calls; every failure caught → `logTerminal('Status sync failed (offline?).', 'error')`

- [ ] **Step 1: Implement** — subscribe like `useTaskCompletionToasts` with watermark refs:
  - **In-transit:** track a local `Set<string>` of dispatched task ids; on subscription, scan `state.agents` for `status === 'walking' && currentTask?.noteId && targetKind === 'task'` not yet sent → `PATCH { status: 'in_transit' }`.
  - **Filed:** `collectNewCompletions(state.completions, seenCompletions)` → for each with `noteId` → `PATCH { status: 'filed' }`.
  - **Archived:** watermark over `state.archivedTasks` → `PATCH { status: 'archived' }` (M2; harmless to include now).
  - Shared helper `patchStatus(noteId, status)` — `fetch('/api/notes/' + noteId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })`; `.catch(() => { useAgentStore.getState().logTerminal(...) })`.
- [ ] **Step 2: Mount in `NotelingsUI`** next to `useTaskCompletionToasts()`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; browser happy path: submit note with live Gemini+Supabase → Kanban card moves Pending → In Transit (robot walks) → Filed (delivery) and the DB row's status flips (check dashboard). E2E mocks (Task 12) cover the mocked path.
- [ ] **Step 4: Commit** — `feat: push robot lifecycle status transitions to the notes table`

### Task 11: Robot note-card visual

**Files:**
- Modify: `components/office/AgentRobot.tsx`

**Interfaces:**
- Produces: `robot-note` mesh child on each robot group (hidden idle; additive — E2E robot-part contract untouched)

- [ ] **Step 1: Implement** — inside the robot `<group>`, after the glow mesh:

```tsx
<mesh
  name="robot-note"
  position={[0, BODY_Y + 0.62, 0]}
  rotation={[0, 0, 0.35]}
  castShadow
  visible={carrying}
  userData={{ notelingsRobotPart: 'note' }}
>
  <boxGeometry args={[0.26, 0.03, 0.34]} />
  <meshStandardMaterial color="#ffffff" roughness={0.7} />
</mesh>
```

  `carrying` derived from a new `currentTask` selector: `visible = currentTask ? (currentTask.kind === 'note' ? status === 'walking' || status === 'processing' : status === 'processing' || targetKind === 'archive-final') : false` (archive: card appears only after the pickup at the destination, per spec).
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm test`; E2E baseline still green (Task 12). Browser: robot carries a small white card while walking a note.
- [ ] **Step 3: Commit** — `feat: robots carry a visible note card during deliveries`

### Task 12: Milestone 1 E2E + full validation

**Files:**
- Modify: `e2e/office-smoke.spec.ts`

- [ ] **Step 1: Extend the baseline test** — assert: kanban heading `Spatial Board` visible; three columns (`Pending`, `In Transit`, `Filed`); terminal log element present; `robot-note` exists and is hidden while idle (scene walk like the glow check). Add `page.route('**/api/notes/**', route => route.fulfill({ json: [] }))` BEFORE `goto` so baseline is deterministic (kanban renders empty states; no real-DB dependency).
- [ ] **Step 2: Extend the happy-path test** — mock `**/api/notes/**`: GET → `[{ id: 'note-e2e-work', content: 'plan the Q3 roadmap', category: 'Work', tags: ['roadmap'], status: 'pending', created_at: new Date().toISOString() }, { ... 'note-e2e-admin' 'print the vendor contracts' 'Admin' ... }]`; PATCH → echo `{ status }`. Assert: kanban shows both notes in Pending; after delivery, the terminal contains a `filed` line; existing toast + arrival assertions unchanged (delivery completion still moves `completions`; status PATCH goes to the mock).
- [ ] **Step 3: Run the full gate** — `npx tsc --noEmit && npm test && npm run lint && npm run build && npm run test:e2e`. All 83+ unit tests and 3/3 E2E green.
- [ ] **Step 4: Browser smoke** — manual: kanban live-moves a real note through Pending → In Transit → Filed; terminal logs; robots carry cards; zero console errors.
- [ ] **Step 5: Commit** — `test: phase2 M1 e2e coverage`

**MILESTONE 1 GATE → user tests. Do not start M2 until approved.**

---

# MILESTONE 2 — Note Management (Edit & Archive)

### Task 13: Edit modal (content + tags)

**Files:**
- Create: `components/notelings/GlassModal.tsx`, `components/notelings/NoteEditModal.tsx`
- Create: `lib/notes/notesApi.test.ts` (schema tests)
- Modify: `components/notelings/NoteCard.tsx` (wire `onEdit`), `components/notelings/KanbanPanel.tsx` (hold `editingNote` state)

**Interfaces:**
- Consumes: `NotePatchSchema` (Task 3), store `upsertNote`/`logTerminal`
- Produces: `GlassModal` (framer-motion backdrop + `liquid-glass-strong` panel, ESC + backdrop close); `NoteEditModal({ note, onClose })`

- [ ] **Step 1: Schema tests** — `NotePatchSchema.safeParse({})` fails; `{ content: 'x' }` passes; `{ tags: ['a','b'] }` passes; `{ tags: [] }` fails (empty array violates `min(1)` per-item — array itself is optional); `{ status: 'bogus' }` fails.
- [ ] **Step 2: Implement** — `GlassModal`: `AnimatePresence` fade/scale; focus first input on open; ESC via `onKeyDown`; backdrop click closes; `role="dialog" aria-modal="true"`.
- [ ] **Step 3: Implement** — `NoteEditModal`: react-hook-form + `zodResolver` (content 1–1000, tags comma-separated ≤5); Save → `PATCH /api/notes/[id]` with `{ content, tags }` → on success `upsertNote(returned)` + `logTerminal('Note edited.')` + `toast.success('Note updated.')` + close; failure → error toast, keep modal open.
- [ ] **Step 4: Wire** — `NoteCard` gets a pencil button (`Edit note` aria-label) calling `onEdit`; `KanbanPanel` opens the modal with the clicked note.
- [ ] **Step 5: Verify** — `npx tsc --noEmit`; `npm test`; browser edit round-trip on a real note.
- [ ] **Step 6: Commit** — `feat: edit note content and tags`

### Task 14: Archive UI + agentic delete flow

**Files:**
- Modify: `components/notelings/NoteCard.tsx`, `components/notelings/KanbanPanel.tsx`
- Modify: `components/notelings/completionToasts.ts` (+ test)
- Modify: `components/office/AgentRobot.tsx` (already added kinds in Task 4 — now the arrival/processing branches)

**Interfaces:**
- Consumes: store `markNoteArchiving` + `enqueueArchive` (Task 4)
- Produces: archive button on every card → chained robot walk (destination → trash `[29,24]`) → `PATCH {status:'archived'}` via `useNoteSync` → card leaves the kanban; `archiveToastMessage(completion)`

- [ ] **Step 1: `AgentRobot` arrival/processing branches** — in the command effect path-failure branch and the `useFrame` arrival branch, extend the kind switch: `'task' → arriveAtTask`, `'archive' → arriveArchiveStage`, `'archive-final' → arriveArchiveFinal`, `'wander' → finishWander`; failure for archive kinds → `failTask` (error + recovery, no archive side effects). Processing effect: `if (agent.currentTask?.kind === 'archive') completeArchiveStage(agentId) else completeTask(agentId)`.
- [ ] **Step 2: `completionToasts.ts`** — add `archiveToastMessage(completion: TaskCompletion): string` → `` `Note archived — ${AGENT_DISPLAY_NAMES[completion.agentId]} filed it in the trash.` `` + test.
- [ ] **Step 3: Archive button** — `NoteCard` archive icon button (`Archive note` aria-label, only when not archiving); click → `markNoteArchiving(noteId)` + `enqueueArchive({ noteId, category, content, tags })` + `toast('Archiving…', { id: 'archiving-' + noteId })`.
- [ ] **Step 4: Completion side** — `useNoteSync` already PATCHes `archived` (Task 10); `useTaskCompletionToasts`-style hook (`useArchiveToasts` inline in `useNoteSync`) fires `toast.success(archiveToastMessage(...))` + `toast.dismiss('archiving-' + noteId)` per archived task (watermark over `state.archivedTasks`).
- [ ] **Step 5: Verify** — `npx tsc --noEmit`; `npm test`; browser: archive a real note → robot walks to the category destination, card appears, walks to the trash can, note vanishes from the board, DB status `archived`.
- [ ] **Step 6: Commit** — `feat: agentic archive — robots carry notes to the trash`

### Task 15: Archived view (restore / delete forever)

**Files:**
- Create: `components/notelings/ArchivedView.tsx`
- Modify: `components/notelings/KanbanPanel.tsx` (toggle)

**Interfaces:**
- Consumes: store `notes` (filter `status === 'archived'`), `PATCH`/`DELETE` routes

- [ ] **Step 1: Implement** — header toggle (`Archive` chip with count) switches the panel body to the archived list: cards with `Restore` (PATCH `{status:'filed'}` → `upsertNote` + log + toast) and `Delete forever` (confirm via `GlassModal` → `DELETE /api/notes/[id]` → `removeNote` + log).
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; browser round-trips (archive → restore → filed; archive → delete → gone from DB).
- [ ] **Step 3: Commit** — `feat: archived notes view with restore and permanent delete`

### Task 16: Milestone 2 E2E + full validation

**Files:**
- Modify: `e2e/office-smoke.spec.ts` (new 4th test: archive flow with mocked routes)

- [ ] **Step 1: Archive E2E** — mock `/api/categorize` (one Work note) + `**/api/notes/**` (GET returns the note `pending`; PATCH echoes `{status}`; DELETE `{ok:true}`). Click `Archive note` on the card → wait for `window.__NOTELINGS_AGENTS__` blue agent `targetKind === 'archive'` → wait `'archive-final'` → wait `archived` card removal (kanban no longer renders it) + `Success`-style archive toast + terminal contains `archived`. Timeout 90s (SwiftShader walks).
- [ ] **Step 2: Full gate** — `npx tsc --noEmit && npm test && npm run lint && npm run build && npm run test:e2e`.
- [ ] **Step 3: Memory docs** — write `docs/adr/0002-phase2-realtime-control-center.md` (decisions: server write routes + anon read-only realtime; soft archive; legacy→filed; two-leg archive task; terminal cap 100); update `CONTEXT.md` (Kanban, Terminal, Archived, Trash destination); append `handoff.md` "Work completed — Phase 2 M1+M2".
- [ ] **Step 4: Commit** — `test: phase2 M2 e2e + docs`

---

## Self-Review

**Spec coverage (PHASE_2_SPEC_FINAL):**
- §2 aesthetic rules → Tasks 8–9 (glass, grayscale, typography, hover/icon anatomy; no mesh click handlers)
- M1 right panel Kanban with 3 columns → Tasks 8 (+5)
- M1 bottom terminal with monospace log + input embedded → Task 9
- M1 core-loop sync (pending/in_transit/filed) → Tasks 4, 10 (+ Task 2 route status)
- M2 edit modal (content + tags → Supabase) → Task 13
- M2 Complete/Archive button → Task 14
- M2 agentic delete (walk to destination, pickup, walk to trash) → Tasks 4, 5, 11, 14 (soft archive per user decision + Task 15 restore/delete)
- §5 execution rules → Realtime `removeChannel` cleanup (Task 7), terminal cap 100 (Task 4/6), no R3F unmount/dispose (Task 11 + rules), component modularity (all tasks), responsive (Tasks 8–9 mobile toggles), non-destructive (Tasks 3–5, 14 additive; validation gates)
- Phase 3 out of scope → not built

**Placeholder scan:** none — every task has concrete code/signatures/assertions.
**Type consistency:** `NoteStatus`/`NoteRecord` flow through `notesApi` → routes → store → kanban; `TaskKind`/`noteId`/`finalDestination` consistent across store/robot/destinations; `TRASH_STAGING_CELL [29,24]` referenced identically in Task 4 tests, Task 5, Task 14.

**Known risks & mitigations**
- Realtime event delivery to the SAME browser that wrote the row: Supabase delivers it; store `upsertNote` is idempotent so double-applies are safe.
- E2E determinism: all `/api/notes/**` traffic mocked; realtime socket is untouched by mocks (real events for real rows only) — kanban assertions use mocked GET data.
- Archive tasks must never emit the delivery toast → separate `arriveArchiveFinal` path (tested in Task 4).
- `agentStore` must stay import-safe for tests: `completionToasts.ts` and `terminalLogs.ts` are pure (no React).
- SwiftShader slow frames: archive E2E gets the 90s budget like the existing delivery tests.
