# MASTER_INFO.md — Notelings Project Brief for AI Collaborators

> **Purpose:** This file is the single source of truth for ANY external AI (e.g. a Perplexity chat using Gemini Pro) that is helping brainstorm features, plan work, or answer questions about **Notelings** — without access to the codebase. Read this cold and you should know exactly what the project is, how it works, how it looks, what's done, what's next, and what NOT to suggest.
>
> **Last updated:** 2026-08-12 · **Maintained alongside:** `knowledge.md`, `handoff.md`, `CURRENT_STATE.md`, `PRODUCT.md`, `DESIGN.md`.

---

## 1. TL;DR

**Notelings** is a gamified, visual "Second Brain" note organizer inspired by SAMS (Spatial Agentic Management System). You type a note into a glassmorphism UI; a backend LLM (Google Gemini 2.5 Flash) categorizes it; and a capsule-shaped "Librarian" robot physically **walks the note across a 3D isometric office** and files it at the matching category destination (bookshelf/cabinet). It turns note-taking into a calm, watchable, delightful living diorama.

- **Solo personal project** (single user, no auth), built as a web app.
- **Written in:** TypeScript, React/Next.js (App Router), React Three Fiber, Supabase (Postgres), Zustand.
- **Repo:** `https://github.com/connorpaps/Notelings-App.git` (branch `main`).

---

## 2. Current status (date-stamped)

| Area | Status |
|---|---|
| **Phase 1** (M1 static room · M2 robots/pathfinding · M3 task queue · M4 UI+LLM) | ✅ Complete |
| **Phase 2** (M1 Kanban+Terminal · M2 edit/archive · M3 tag browser · M4 RAG chat) | ✅ Complete |
| **Phase 2 · M5 Knowledge Graph** | ⏭️ **Next feature — NOT started** |
| **Phase 3** (Obsidian sync, rigged animation, physics) | 🚫 Out of scope (one item — the GLB "3D Engine Overhaul" — was already pulled forward and shipped) |
| **Security hardening pass** | ✅ Shipped 2026-08-12 (see §9) |
| **Tests** | 173 unit (Vitest) + 6 E2E (Playwright), all green |

The project is **feature-complete through its entire shipped roadmap**. The single next planned feature is **M5: the Knowledge Graph**. Beyond that it's open-ended brainstorming territory.

---

## 3. The product — what the user sees and does

### Visual composition (layers, back → front)
1. **`z-0` Background** — a static still frame (1920×1080) extracted from a "Skybridge" reference video (`public/images/skybridge-background-frame.jpg`), dark city-bridge scene, `object-cover`. Over it: a flat black scrim (`bg-black/45`) + a radial vignette + a slow-drifting white "ambient glow" light pool (screen blend, disabled under `prefers-reduced-motion`).
2. **`z-10` The 3D office** — a colored, textured 3D office rendered in a transparent WebGL canvas, floating center-screen. This is the visual centerpiece; it is the ONLY large area of color.
3. **`z-20` The glass UI** — a frosted, strictly **grayscale** glassmorphism overlay.
4. **`z-30`** welcome hero + command dock.
5. **Toasts** — dark glass, bottom-right.

### The aesthetic ("Bloom liquid-glass world")
- **Typography:** Poppins (body/display, weights 400/500/600) + **Source Serif 4** (italic *accents* inside headings only).
- **Color:** near-monochrome. Text uses `white` at opacities 100/80/60/50/40. Glass fills are `rgba(255,255,255,0.01)` with luminosity blending. The **only** accent colors are the three robot identity dots: **blue `#2fa8e0`**, **green `#43c98b`**, **red `#ef4444`**.
- **Glass tiers:** `.liquid-glass` (4px blur, inset top highlight, 1.4px gradient border) and `.liquid-glass-strong` (50px blur, 4px drop shadow) — for panels/dock/modal. A rotating monochrome **glow ring** (`@property` conic gradient, 8s spin) hugs glass edges.
- **Motion:** hover `scale-105` / active `scale-95` micro-interactions, AnimatePresence list animations, pulsing red error glow.

### On-screen layout (desktop)
- **Top-left:** brand bar — "**notelings**" wordmark + serif italic "second brain".
- **Top-right:** a live "**N agents online**" glass pill with a pulsing dot, plus two small view-control buttons: "**Edit nav**" (toggles a hidden dev tool that lets you paint the walkable navigation grid on the floor) and "**Hide UI**" (collapses all chrome to just the office; both buttons stay reachable to bring it back).
- **Left:** three glass **agent status cards** — Blue Librarian, Green Archivist, Red Security/Error — each with an icon, the robot's glowing identity dot, and its live status ("Idle — awaiting tasks", etc.).
- **Right:** the **Spatial Board** — a 3-column Kanban (**Pending / In Transit / Filed**) showing every note and its live status. (Hidden below `lg` breakpoint; becomes a bottom sheet toggle on mobile.)
- **Bottom-center:** the **Command Dock** — a strong-glass pill containing a note input (with a "New Note / Ask AI" segmented toggle) and a monospace **Terminal event log** to its right.
- **First load:** a **Welcome hero** ("Spatial Second *Brain*") with three destination pills and an "**Initialize Agents**" CTA that dismisses it.

### The 3D office (what's actually in the scene)
- A **10.1 × 10.1 m** detailed office loaded from one **GLB** model (`public/models/3D_Note_Office_2/3d_note_office.glb`, ~18 MB, clean glTF 2.0, no Draco). It has a floor, walls, desks, chairs, filing cabinets, a glass-walled manager's office, a bookshelf, and a trash bin.
- Three **code-generated robots** (capsule body + a flat LCD "face" plane): they slide around the floor (no legs/rigging — deliberate). The face shows an expression mapped to state: `^ ^` idle, `O O` walking, `- -` processing, `X X` error.
- Robots are ~72% original scale, carry a small white "note card" (clipboard) while delivering.
- **Only Blue & Green carry tasks** (max 2 concurrent deliveries). **Red** is the *error sentinel*: it wanders with the others but never takes a task, and lights up (pulsing red glow + `X X` face) whenever an LLM/network failure is flagged, auto-recovering after ~5s.
- **Idle agents wander**: a robot with nothing to do picks a random reachable floor cell and walks there every ~1.5–3.5s, so the office always feels alive (a queued task instantly preempts the wander).

### The user flow (happy path)
1. Type a note in the dock → **Submit**.
2. The LLM categorizes it as **Work / Admin / Uncategorized** and extracts **tags**.
3. The note appears in **Pending** on the Kanban and in the terminal log.
4. An idle robot wakes (`O O`), walks to the destination, "files" it (`- -` for 2s), and the note moves **In Transit → Filed**.
5. A toast confirms: "Success: Blue Agent filed your note in Work."

### Edge cases & note management
- **LLM failure never blocks persistence or delivery.** If categorization fails (10s timeout / API error), the note is still saved as **Uncategorized** with a `degraded` flag, an error toast fires, the **Red** robot flashes its error state, and the note is *still* delivered to the corkboard. If the server is entirely unreachable, the note is dispatched locally (no DB row) as Uncategorized — a documented MVP limitation.
- **Edit:** click any note card to edit its text/tags (server PATCH).
- **Archive is agentic:** archiving a note sends a robot to the note's shelf to "pick it up", then walks it to the trash bin; the row is soft-deleted (`archived`, restorable from an Archived view).
- **Browse by tag:** the Tag Explorer modal lists every tag and filters the board/notes by the selected tag.

## 4. How it works under the hood

### Core loop (write path)
```
CommandDock (react-hook-form + zod, 1000-char cap)
  → POST /api/categorize  (Next.js route, nodejs runtime)
      → Gemini 2.5 Flash `generateObject` (strict zod schema; 10s timeout; maxRetries 0)
      → Supabase INSERT into `notes` (status 'pending', via SERVICE-ROLE key)
  → client Zustand store: enqueueTask → dispatchAvailableTasks()
      → first IDLE blue/green agent gets status 'walking', target = destination cell
  → AgentRobot (R3F useFrame) A*-paths cell-to-cell, lerps across the floor
      → arriveAtTask → 'processing' (2s) → completeTask → 'idle' + completion event
  → useNoteSync PATCHes status: pending → in_transit → filed  (server route, service role)
  → toast.success("Success: <Agent> filed your note in <Category>.")
```

### State machine (Zustand `agentStore.ts`)
- **Agents:** `blue`, `green` (dispatchable) + `red` (error sentinel, never dispatched). Each has `status: idle | walking | processing | error`, a `currentTask`, a `target` grid cell, and a `commandRevision` (intent boundary — the robot only acts on *new* revisions).
- **Task queue:** FIFO. `dispatchAvailableTasks()` assigns tasks to idle agents in order.
- **Task kinds:** `note` (deliver) and `archive` (two-leg: walk to destination → "pick up" → walk to trash staging cell → dispose).
- **Lifecycle events** are written to Zustand only at command boundaries — never per-frame (per-frame movement mutates local Three.js refs only).

### Categories → destinations
| Category | Internal key | Physical destination | Staging cell |
|---|---|---|---|
| Work | `whiteboard` | Manager's Bookshelf (glass office) | `[22, 37]` |
| Admin | `printer` | Filing Cabinets | `[34, 4]` |
| Uncategorized | `corkboard` | Hallway Bookshelf | `[3, 21]` |
| (archive) | — | Trash bin | `[27, 8]` |

### Nav Grid Editor (dev tool)
- Hidden behind the header's **"Edit nav"** toggle, it overlays the floor with its walkable cells (red squares) and lets you **paint/erase** them by click-drag. Edits persist in `localStorage`; **"Copy map"** exports the final blocked-set as JSON, which you bake into the shipped nav map with `node scripts/lock-in-grid.mjs <export.json>`.

### Navigation
- 2D grid **42×42 cells @ 0.25 m**, baked from the GLB geometry into `newOfficeGridData.ts` (**1192 blocked / 572 walkable** cells). The blocked map already includes the robot's full 0.30 m center clearance (runtime clearance = 0).
- **A\*** (4-directional, Manhattan) in `pathfinding.ts`; robots move cell-center to cell-center at a fixed world speed with smooth heading turns (no corner-smoothing curves in the active GLB office — `smoothPath=false`).

### Realtime & persistence
- `notes` table in Supabase Postgres; the client mirrors it via an initial `GET /api/notes` + a **Supabase Realtime `postgres_changes`** channel (INSERT/UPDATE/DELETE). Writes go ONLY through server routes (service role); the browser anon key is read-only.
- **Status lifecycle:** `pending` → `in_transit` (robot dispatched, after a ~1.5s beat) → `filed` (delivered); `archived` is soft-delete.

### "Ask the Librarian" (RAG chat)
- `POST /api/chat` streams `gemini-2.5-flash` at **temperature 0, maxRetries 0** with a strict-grounding prompt: refuses out-of-scope questions verbatim ("I couldn't find any notes related to that."), cites notes as `[n]`, allows grounded partial answers.
- Context = the 150 newest non-archived notes; above that it uses **embedding retrieval** (`gemini-embedding-001`, top-K 60).
- **Count questions** ("how many notes…?") are answered **deterministically in code** — no LLM call.
- Chat history pruned to last 20 messages server-side.

---

## 5. Tech stack (exact)

| Concern | Choice |
|---|---|
| Framework | Next.js **16.3.0** (App Router, Turbopack), React **19.2.8**, TypeScript 5 |
| Styling | Tailwind CSS **v4**, `class-variance-authority`, `tailwind-merge`, `clsx` |
| 3D | `@react-three/fiber` 9.7.0 · `@react-three/drei` 10.7.8 · `@react-three/postprocessing` 3.0.4 · `three` 0.185.1 |
| State | `zustand` 5.0.14 |
| DB | Supabase Postgres (`@supabase/supabase-js` 2.112.2) |
| AI | Vercel AI SDK `ai@7.0.58` + `@ai-sdk/google@4.0.39` + **`@ai-sdk/react@4.0.61`** |
| Validation | `zod` 4.4.3 |
| Forms | `react-hook-form` 7.85 + `@hookform/resolvers` 5.7 |
| Animation | `framer-motion` 13 |
| UI primitives | shadcn/ui (base-nova), `lucide-react`, `sonner`, `next-themes`, `tw-animate-css`, `@base-ui/react` |
| Server-only guard | `server-only` |
| Tests | Vitest 4.1.10 (unit) · `@playwright/test` 1.62.1 (E2E) |

**LLM:** Google Gemini (2.5 Flash for categorize + chat; `gemini-embedding-001` for retrieval). (The spec also mentions Groq as an alternate provider, but Gemini is what's wired up.)

---

## 6. Codebase map

```
app/
  layout.tsx            fonts (Poppins/Source Serif 4) + metadata + direction-contract meta
  page.tsx              composition: BackgroundVideo → OfficeCanvas → NotelingsUI → GridEditorPanel
  globals.css           design tokens + .liquid-glass/.glass-glow-* classes
  api/
    categorize/route.ts POST: LLM categorize → Supabase save (origin guard + rate limit)
    chat/route.ts       POST: RAG chat stream (origin guard + rate limit)
    notes/route.ts      GET: all notes (service role)
    notes/[id]/route.ts PATCH/DELETE: edit/status/delete
    tags/route.ts       GET: unique tags

components/
  notelings/            the 2D glass UI overlay (see §3)
    NotelingsUI, WelcomeScreen, AgentStatusCard, KanbanPanel, KanbanColumn,
    NoteCard, ArchivedView, CommandDock, TerminalDock, TerminalLog, ChatPanel,
    TagExplorerModal, NoteEditModal, GlassModal, GlassPanel, BackgroundVideo,
    OfficeViewControls, completionToasts,
    useNotesRealtime, useNoteSync, useSubmitNote, useLibrarianChat,
    useArchiveToasts, useTaskCompletionToasts
  office/               the 3D scene + navigation + agents
    OfficeCanvas          R3F <Canvas>: camera, lights, postprocessing
    NewOfficeScene / NewOfficeModel   GLB load + recenter
    AgentLayer / AgentRobot           robots, useFrame movement, LCD faces
    agentStore / agentState / agentFace / agentDestinations / agentWandering
    pathfinding           A*, grid transforms, safe-curve, free-cell helpers
    newOfficeGrid / newOfficeGridData / newOfficeLayout    active nav grid (42×42)
    GridDebugOverlay / GridEditorPanel / gridEditor / gridEditorStore / officeViewStore
    officeMode            ENABLE_OFFICE_BUILDER / ENABLE_PATH_PREVIEW flags
    VoxelOffice_Legacy / OfficeModel / OfficeLockedScene / OfficeBuilder* / officeLayout /
    agentGrid / officeAsset* / Floor     (LEGACY .obj office — preserved as backup)
  ui/                   shadcn base (button, input, sonner, spinner)

lib/
  notes/                domain logic (pure, unit-tested):
    categorization, categorizeNote, chatApi, chatContext, citations, countIntent,
    embeddingRetrieval, similarity, kanban, notesApi, tags, terminalLogs, types, uiMessageStream
  supabase/client.ts    browser client (anon key, Realtime only)
  supabase/server.ts    server client (service role, 'server-only' guarded)
  apiGuard.ts           same-origin guard + rate limiter (new 2026-08-12)

supabase/
  schema.sql            fresh-install schema + read-only anon RLS
  migrations/           20260809_phase2.sql, 20260812_security_hardening.sql

scripts/
  dev-server.sh         detached dev-server launcher (no tmux on Windows)
  generate-new-office-grid.mjs, lock-in-grid.mjs
  machine-sync.sh, memory-watcher.mjs, setup-memory-hooks.sh
```

---

## 7. Data model

**Table `notes`** (Supabase Postgres):
- `id` uuid PK (default `gen_random_uuid()`)
- `content` text NOT NULL
- `category` varchar NOT NULL default `'Uncategorized'` (`Work` | `Admin` | `Uncategorized`)
- `tags` text[] NOT NULL default `'{}'` (1–5 short labels from the LLM)
- `status` varchar NOT NULL default `'pending'` — constraint: `pending | in_transit | filed | archived`
- `created_at` timestamptz default `now()`
- `updated_at` timestamptz default `now()`

**RLS (post-hardening):** enabled; the `anon` role is **READ-ONLY** (`notes_anon_read` SELECT-only policy). All writes flow through server routes using the **service-role** key (bypasses RLS). Realtime uses `replica identity full` and the `notes` table is in the `supabase_realtime` publication.

**Env vars** (`.env.local`, never committed; template in `.env.example`):
`GOOGLE_GENERATIVE_AI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 8. API surface

| Route | Method | Purpose | Guarding |
|---|---|---|---|
| `/api/categorize` | POST | LLM categorize + save note | origin guard + rate limit (30/min) |
| `/api/chat` | POST | RAG chat (SSE stream) | origin guard + rate limit (20/min) |
| `/api/notes` | GET | list all notes | origin guard |
| `/api/notes/[id]` | PATCH / DELETE | edit status/content/tags; hard delete | origin guard |
| `/api/tags` | GET | unique tags (non-archived) | origin guard |

(These are *casual* guards added 2026-08-12 — origin check + in-memory rate limit — not real auth. Single-user MVP.)

---

## 9. Roadmap & what's next

### ✅ Done (all shipped & validated)
Phase 1: static room → robots + A* → task queue/dispatcher → UI + LLM core loop.
Phase 2: Kanban + Terminal + Realtime → Edit + agentic Archive → Tag browser → "Ask the Librarian" RAG chat. Plus: clickable `[n]` citations, deterministic counting, embedding retrieval for large vaults, tag filter, a hand-painted + locked-in nav map, an interactive Nav Grid Editor (dev tool), and a 2026-08-12 security/cleanup pass.

### ⏭️ The ONE planned next feature — M5 Knowledge Graph
- Add a "**Graph View**" button that opens a full-screen `.liquid-glass` overlay.
- Visualize notes as a **network graph**: notes = nodes, edges drawn between notes that **share a tag string**.
- Suggested library in the spec: `react-force-graph-2d` (lightweight force-directed graph).
- This is the natural "visualize connections" capstone to the Second Brain.

### 🔮 Open-ended future ideas (brainstorming territory — no commitments)
These are the obvious directions, NOT a plan: richer knowledge graph (category clusters, tag communities, node sizing by age/importance, search-in-graph), voice capture, recurring tasks/reminders, note search across the UI, undo/redo, themes, mobile-first polish, an "office upgrades" meta-game (buy furniture/robots), daily/weekly summary digests, PDF/export, multi-office "worlds". Feel free to go beyond this list.

---

## 10. Hard constraints & non-goals (what NOT to suggest)

Per the project's master spec, these are **explicitly out of scope** — suggesting them as if they're "next steps" is wrong:
1. **No authentication / multi-user** — single-user, browser-session app. No login, no user tables, no sharing.
2. **No physics / colliders** — robots move by coordinate lerping on a grid, not a physics engine.
3. **No rigged/skeletal animation** — capsules slide/float; no Mixamo/leg-rig/walking cycles.
4. **No multi-user sync** — Realtime is one-directional (DB → UI) only.
5. **No Obsidian vault sync/export** (Phase 3, explicitly deferred).

Also, **never** suggest: changing the 3D scene's core (camera/lighting/shadow/postprocessing profile), breaking the `pointer-events-none` overlay contract, per-frame React state updates in `useFrame`, or reparenting `useGLTF`/`useLoader` results (breaks under React 19 StrictMode).

---

## 11. Gotchas (things that have bitten us — keep in mind when proposing ideas)

- **Zustand selectors must return stable references** (selecting `Object.values(...)` in a selector crashes with "getServerSnapshot should be cached").
- **Overlays inside `pointer-events-none` roots** need `pointer-events-auto` on their interactive containers.
- **AI SDK v7 has no `ai/react`** — use `@ai-sdk/react@4` `useChat` + `DefaultChatTransport`; `UIMessage` renders from `parts`, not `.content`.
- **R3F:** never call React `setState` inside `useFrame`; mutate refs. A* and curve math belong in effects, not the render loop.
- **The new office owns its clearance in the baked map** — the runtime path-safety sweep must stay `0` (raising it re-breaks every delivery path).
- **Windows dev machine:** no `tmux` — use `bash scripts/dev-server.sh start`. Keep `.sh`/`.mjs`/hook files LF line endings.
- **E2E:** warm the dev server (one page load) before running, and the pixel-sampling test needs `NEXT_PUBLIC_PRESERVE_DRAWING_BUFFER=1`.

---

## 12. Commands

```bash
npm run dev                 # dev server on :3000 (or: bash scripts/dev-server.sh start|status|logs|stop)
npm test                    # Vitest unit tests (173)
npm run test:e2e            # Playwright (6 tests)
npm run lint                # ESLint
npm run build               # production build
npx tsc --noEmit            # typecheck
node scripts/lock-in-grid.mjs <export.json>   # bake a hand-painted nav map into newOfficeGridData.ts
```

---

## 13. How to give me the most useful ideas

- Ground ideas in **this document's reality**: the office is the product's stage, the glass UI is grayscale, the robots are simple but expressive, and everything already shipped is table-stakes (don't re-invent it).
- Bias toward features that **extend the existing loop** (capture → categorize → visualize → retrieve) rather than replace it.
- Prefer **small, incremental, delightful** additions that fit the "calm, watchable, living diorama" feel.
- Flag when an idea touches a **non-goal** (§10) or a known **gotcha** (§11).
- If you propose a concrete implementation, suggest the **stack-appropriate** approach (Next.js App Router route + Supabase + Zustand + R3F + Tailwind v4 + the existing `.liquid-glass` design system).
