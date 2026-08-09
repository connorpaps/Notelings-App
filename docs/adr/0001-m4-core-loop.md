# ADR-0001: Milestone 4 core-loop architecture

- **Date:** 2026-08-09
- **Status:** Accepted (user-approved during M4 planning grilling)

## Context

M4 closes the core loop: notes → LLM categorization → Supabase persistence → robot delivery. The external M4 brief referenced a "Red Agent" and only two destinations, but the app shipped exactly two robots (Blue/Green) and two task destinations (`whiteboard`, `printer`). We needed a failure path, an "Uncategorized" home, and a single write path without over-building.

## Decisions

### 1. One server route is the single write path (`POST /api/categorize`)

The route zod-validates the note (1–1000 chars), calls `generateObject` (`gemini-2.5-flash`, strict schema, 10s `abortSignal`, `maxRetries: 0`), inserts into Supabase with the **service-role key**, and returns `{ id, category, tags, degraded }`. The client never touches the DB or the LLM directly; `SUPABASE_SERVICE_ROLE_KEY` never enters the client bundle, and `lib/supabase/server.ts` carries `import 'server-only'` so accidental client imports fail the build.

### 2. Red is a non-dispatchable error sentinel

The spec's Red "Security/Error" agent exists in the UI and scene but never takes tasks (`dispatchAvailableTasks` roster stays `['blue','green']`). On LLM failure the client calls `signalError('red')`: `X X` face, pulsing red additive glow (opacity driven in `useFrame`), 5s auto-recovery. Rationale: error signalling without disturbing the approved two-agent dispatch semantics.

### 3. A third destination: Corkboard `[27,4]`

`Uncategorized` notes need a physical home. Bound to locked item `asset:misc-office-misc-w-40665142` (`Misc Wall Corkboard 02`, anchor cell `[25,3]`). Staging is `[27,4]` because `[25,4]`/`[26,4]` are blocked by `Table White 2x2 01` (measured against the real blocked map).

### 4. Save AND dispatch on LLM failure

On timeout/API failure the route still saves the note as `Uncategorized` (`status: 'pending'`) and returns `degraded: true`; the client toasts an error, flags Red, and still enqueues the task to the corkboard. Only a total network failure (route unreachable) skips the DB row — documented MVP limitation.

### 5. Category → destination mapping

`Work → whiteboard`, `Admin → printer`, `Uncategorized → corkboard` — defined once in `lib/notes/categorization.ts` (shared by client and route, scene-free).

## Consequences

- Single server round-trip per note; the client UI stays thin.
- Free-tier Gemini limits (~10 RPM / 250 RPD) bound abuse, but the deployed route is unauthenticated — acceptable for a personal MVP; a shared-secret/origin guard is the first hardening step if the app is shared publicly.
- The anon RLS policy is permissive (single-user, no auth); the service role bypasses RLS.
