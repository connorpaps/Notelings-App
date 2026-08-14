# Manual / Needs Sorting Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make AI-off capture tags-only while preserving a meaningful distinct manual state and routing manual notes to the Hallway Bookshelf.

**Architecture:** Add `Manual` as a fourth internal note category/state, mapped to the existing Hallway Bookshelf destination. The manual UI will collect note content plus optional tags only; the server will assign `Manual`, while `Uncategorized` remains reserved for AI classification fallback and AI results that do not fit Work/Admin.

**Tech Stack:** Next.js route handlers, Zod, React Hook Form, Zustand, Supabase Postgres/RLS, Vitest, Playwright.

## Global Constraints

- Preserve the existing GLB office and physical destination labels.
- Do not add a new provider or package.
- Manual capture must never call Gemini.
- Preserve authenticated owner-scoped writes and idempotent `submission_id` behavior.
- Database migrations must be rerunnable and must not rewrite existing note ownership/status data.

---

### Task 1: Extend the domain contract and database constraint

**Files:**
- Modify: `lib/notes/types.ts`
- Modify: `lib/notes/categorization.ts`
- Modify: `lib/notes/categorization.test.ts`
- Modify: `lib/notes/notesApi.ts`
- Modify: `lib/notes/graphData.ts`
- Modify: `components/office/agentDestinations.test.ts` only if category mapping coverage belongs there
- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/20260813_manual_capture_category.sql`

- [x] Add `Manual` to the persisted `NoteCategory` union, while keeping a separate AI-only category schema limited to Work/Admin/Uncategorized so Gemini can never return Manual.
- [x] Map `Manual` to the existing `corkboard`/Hallway Bookshelf destination without changing the visible destination label.
- [x] Add a neutral category graph color for Manual and preserve the existing Work/Admin/Uncategorized colors.
- [x] Extend the notes table category check constraint to accept `Manual`; leave the column default as `Uncategorized` so AI fallback semantics remain unchanged.
- [x] Make the migration idempotent by dropping and recreating only the category check constraint, with no data rewrite.
- [x] Add schema/mapping tests proving Manual is accepted and maps to `corkboard`, while invalid categories remain rejected.

### Task 2: Make the manual API assign the distinct state

**Files:**
- Modify: `app/api/notes/route.ts`
- Modify: `app/api/notes/route.test.ts`
- Modify: `components/notelings/useSubmitNote.ts`

- [x] Remove `category` from the manual request contract; accept `{ content, tags, submission_id? }` and define a manual-only schema.
- [x] Keep server-side tag validation and owner/session/origin/idempotency protections unchanged.
- [x] Insert manual rows with `category: 'Manual'` and `status: 'pending'`.
- [x] Return `Manual` in the response so the client dispatches through the existing Hallway Bookshelf mapping.
- [x] Ensure network-failure local dispatch also uses `Manual` for AI-off submissions.
- [x] Add route tests proving the request cannot select Work/Admin/Uncategorized for the manual endpoint and that the inserted row is Manual.

### Task 3: Simplify the manual capture UI

**Files:**
- Modify: `components/notelings/CommandDock.tsx`
- Modify: `components/notelings/TerminalDock.tsx` only for copy/title if needed
- Modify: `components/notelings/NoteCard.tsx`
- Modify: `components/notelings/GraphSidePeek.tsx`

- [x] Remove the manual category select and `NoteCategory` form field.
- [x] Keep the optional comma-separated tags field and note content field.
- [x] Submit manual payloads with `{ content, aiEnabled: false, tags }` only.
- [x] Reset only content and tags after successful capture.
- [x] Display Manual notes as `Needs sorting` in note cards and the graph side peek rather than exposing the internal category name.
- [x] Keep AI-created `Uncategorized` notes displayed as `Uncategorized`.
- [x] Add accessible copy clarifying that manual notes are routed to the Hallway Bookshelf for later sorting.

### Task 4: Preserve secondary behavior and add regression coverage

**Files:**
- Modify: `lib/notes/chatContext.test.ts` if expected category context fixtures need updating
- Modify: `lib/notes/countIntent.test.ts` if Manual category matching needs explicit coverage
- Modify: `lib/notes/graphData.test.ts`
- Modify: relevant E2E/manual route tests
- Modify: `README.md`, `knowledge.md`, `handoff.md`

- [x] Confirm chat context includes Manual notes without changing citation behavior.
- [x] Confirm graph nodes accept Manual and use the neutral color without changing tag-driven edges.
- [x] Confirm archive still performs the category-stage walk to Hallway Bookshelf, then trash.
- [x] Add an end-to-end/manual-flow assertion that AI-off capture saves a Manual note with tags and no category selector is present.
- [x] Document that Uncategorized now means AI fallback/uncertain classification, while Manual/Needs sorting means user chose not to use AI.

### Task 5: Validate the complete change

- [x] Run focused categorization, API route, graph, and agent destination tests.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run the relevant Playwright manual/auth flow and then `npm run test:e2e` with the repository’s Windows-safe worker guidance.
- [x] Record any newly discovered lesson immediately and append the completed work/validation to memory files.
