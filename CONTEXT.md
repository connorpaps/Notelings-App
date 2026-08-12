> ⚠️ **STATUS — PARTIALLY OUTDATED (2026-08-12).** Some facts below predate the GLB office swap (2026-08-10) and this session's nav-map lock-in:
> - **Destinations:** user-facing labels are now **Manager's Bookshelf** (Work), **Filing Cabinets** (Admin), **Hallway Bookshelf** (Uncategorized). The "Work Whiteboard / Printer / Corkboard" labels below are the *internal keys* that still exist in code (`TASK_DESTINATIONS`).
> - **Trash staging cell:** now **`[27,8]`** (the bin's own cell `[26,8]` is blocked). The `[29,24]` below is the *legacy office's* trash cell.
> - The **"Agentic Archive"** bullet below still cites `[29,24]` — the current cell is `[27,8]`.

# Notelings — Domain Glossary

A shared vocabulary for the "Second Brain" note-organizer product. Terminology only; see `MASTER_SPEC_FINAL.md` for the spec and `knowledge.md` for implementation details.

## Core concepts

- **Note** — a raw thought or task the user types into the Inbox. Has content, a Category, and Tags. Persisted in the `notes` table.
- **Inbox / Command Dock** — the floating input at the bottom of the screen where notes are composed and submitted.
- **Category** — the LLM-assigned bucket for a note: `Work`, `Admin`, or `Uncategorized`.
- **Tags** — 1–3 short labels the LLM extracts to describe a note.
- **Task** — a queued delivery instruction derived from a categorized note; pairs a note with a Destination and waits in the Global Task Queue.
- **Global Task Queue** — the FIFO list of pending deliveries; a dispatcher assigns the next task to the first available Librarian.
- **Destination** — a physical delivery point in the office: Work Whiteboard, Printer, or Corkboard.
- **Delivery** — a robot walking a note to its destination staging cell, working for two seconds, then returning to idle.
- **Degraded** — the fallback mode when the LLM is unavailable: the note is saved as `Uncategorized` and still dispatched.

## Agents

- **Librarian (Blue)** — the first delivery agent; takes tasks from the queue.
- **Archivist (Green)** — the second delivery agent; takes tasks from the queue.
- **Error Sentinel (Red)** — a non-dispatchable agent that exists to surface failures: on LLM failure it enters `ERROR` with a pulsing red glow and `X X` face, then auto-recovers.

## Categories → destinations

- `Work` → Work Whiteboard (ideas, coding, planning).
- `Admin` → Printer (paperwork, printing, errands).
- `Uncategorized` → Corkboard (everything else; also the degraded-fallback route).

## Phase 2 (SAMS Control Center)

- **Spatial Board (Kanban)** — the right-side live panel with three columns: `Pending`, `In Transit`, `Filed`. Fed by an initial fetch (`GET /api/notes`) plus a Supabase Realtime `postgres_changes` subscription on `notes`; a note moves columns as its DB `status` changes.
- **Terminal (event log)** — the bottom dock's monospace log (capped at 100 entries in the Zustand store): note queued, robot dispatched, note updated, filed, archived, edit/restore/delete events.
- **Status lifecycle** — `pending` (created) → `in_transit` (robot dispatched; after a ~1.5s Pending beat for legibility) → `filed` (delivered). Archiving is soft: `archived` (row kept, restorable from the Archived toggle).
- **Edit** — clicking a note card opens a glass modal; content + comma-separated tags PATCH to Supabase.
- **Agentic Archive** — the Archive button enqueues a two-leg task: the robot walks to the note's destination, picks it up (note card appears), and carries it to the **Trash** staging cell `[29,24]` (adjacent to the locked `Misc Trashcan Small 03`), then the note soft-archives with a confirmation toast.
- **Archived view** — a toggle lists archived notes with Restore (→ `filed`) and Delete forever (hard DELETE).

## Non-goals (MVP)

- No authentication, no physics/colliders, no rigged animation, no multi-user sync.
