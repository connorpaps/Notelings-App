> ⚠️ **STATUS — §4 UPDATED (2026-08-12).** One item listed under "Phase 3 (Future Scope — DO NOT BUILD NOW)" has since been built at the user's request: **"3D Engine Overhaul"** (GLB office) shipped on 2026-08-10 — the active office is `public/models/3D_Note_Office_2/3d_note_office.glb`. The remaining Phase 3 items (Obsidian integration, rigged animations, physical interactions) are still out of scope. §1b M1–M4 status is current.

# TITLE: MASTER SPEC - Phase 2 & Beyond: Obsidian Integration & Polish

## 1. Phase 2 Overview
Phase 1 successfully built the "Write" engine: user inputs a note, the LLM categorizes it, Supabase stores it, and 3D R3F robots visually deliver it. 

Phase 2 focuses on the "Read & Think" engine. We will transform the UI into a real-time Spatial Agentic Management System (SAMS) control center, allowing the user to view their stored notes, edit them, search them via Obsidian-style tags, and chat with their data.

---

## 1b. Implementation Status (2026-08-10)

| Milestone | Status | Notes |
|---|---|---|
| M1 SAMS Control Center (Kanban & Terminal) | ✅ Complete | 3-column live Kanban (Pending / In Transit / Filed) fed by `GET /api/notes` + Supabase Realtime; bottom terminal dock with embedded note input + capped event log; status lifecycle `pending → in_transit → filed` synced by robots. |
| M2 Note Management (Edit & Archive) | ✅ Complete | Edit modal (content + tags), agentic two-leg archive to the trash, archived view with Restore / Delete forever. |
| M3 Obsidian-Style Tag Browser | ✅ Complete | Search icon in the dock opens a `.liquid-glass-strong` Tag Explorer: unique tags via `GET /api/tags`, tag chips with live counts, masonry grid of matching notes, plus a tag filter input. |
| M4 "Ask the Librarian" (RAG Chat) | ✅ Complete | New Note / Ask AI dock toggle; `POST /api/chat` streams via `gemini-2.5-flash` with `temperature: 0`, `maxRetries: 0`, and a strict-grounding system prompt (refuses out-of-context questions verbatim, cites notes `[n]`, allows grounded partial answers, exact counting over content + tags incl. word stems). |
| M5 Knowledge Graph | ⏭️ Next milestone | Not started — planned per §3 below. |

**Recorded implementation decisions (deviations from the original milestone text, per user):**
- **Tag filtering reads the realtime store mirror** (already synced from Supabase), not a per-click DB query — instant and always fresh.
- **Archived notes are excluded** from tag results, tag counts, and the RAG context (retired = not knowledge).
- **Chat context includes `created_at`** per note so metadata follow-ups ("when did I create that note?") are answerable; context is capped at the 150 newest non-archived notes (MVP size bound).
- **Chat history is pruned server-side** to the last 20 messages instead of rejecting longer conversations.
- **`@ai-sdk/react`** (v4) provides `useChat`; AI SDK v7 has no `ai/react` subpath and uses `toUIMessageStreamResponse`.

**Additional additions folded into Phase 2 (2026-08-10, all validated):**
- **Clickable `[n]` citations** — a deterministic global citation index (`lib/notes/citations.ts`) is computed identically server-side (prompt labels) and client-side (realtime store mirror): newest-first by `created_at`, `id` tiebreak. Clicking a citation chip in a chat answer opens an inline preview of that exact note. Works in every context mode (all-notes, retrieval subset, deterministic counts) because numbers are global, not positional.
- **Deterministic counting** (`lib/notes/countIntent.ts`) — count questions ("how many …?") never reach the LLM: the route detects the intent, matches notes over category/content/tags in code, and streams an exact counted answer with citations via a hand-built UI-message SSE stream (`lib/notes/uiMessageStream.ts`). Exact, instant, free.
- **Embedding retrieval for vaults >150 notes** (`lib/notes/embeddingRetrieval.ts` + `lib/notes/similarity.ts`) — above the context cap the route embeds the query and note contents with `gemini-embedding-001` and keeps the top-K (60) most similar notes as context (cosine similarity, deterministic tie-breaks); retrieval failure falls back to newest 150.
- **Tag filter input** — the Tag Explorer now has a live "Filter tags…" search field above the chips.

---

## 2. Global Aesthetic Rules (Strict)
All UI overlays built in Phase 2 MUST adhere to the "Bloom AI / Agent Grove" aesthetic established in Phase 1:
- **Layout:** The 3D isometric office remains a passive visual centerpiece at `z-10` over the looping video background at `z-0`. All UI components are absolute-positioned overlays at `z-20`. Do NOT add interactive click events to the 3D meshes.
- **CSS:** Use the existing `.liquid-glass` and `.liquid-glass-strong` classes for all panels and cards.
- **Color Palette:** Strict grayscale only (`text-white`, `text-white/80`, `text-white/50`). No colored borders or backgrounds.
- **Typography:** `Poppins` for standard text, `Source Serif 4` for italicized accents.
- **Interactions:** Use `hover:scale-105 transition-transform` and Lucide icons in rounded `bg-white/10` containers.

---

## 3. Development Roadmap (Phase 2 Milestones)

### Milestone 1: The SAMS Control Center (Kanban & Terminal)
**Goal:** Build the real-time visual feedback loop so the user can watch their notes move through the system.
*   **The Right Panel (Kanban):** Build a `.liquid-glass` panel on the right side. It fetches all notes from Supabase and subscribes to real-time changes. It has three columns: `Pending`, `In Transit`, and `Filed`.
*   **The Bottom Panel (Terminal):** Build a `.liquid-glass` panel across the bottom containing a monospace event log. Incorporate the existing Note Input form into this dock.
*   **The Core Loop Sync:** Update Zustand and Supabase logic. Note created -> lands in `Pending`. Robot wakes up -> Note moves to `In Transit`. Robot reaches destination -> Note moves to `Filed`. Terminal logs these events.

### Milestone 2: Note Management (Edit & Archive)
**Goal:** Implement full CRUD so the Second Brain is maintainable.
*   **Edit:** Clicking any note card in the Kanban UI opens a `.liquid-glass-strong` modal allowing the user to edit the text or manually add/remove tags. Updates save to Supabase.
*   **Archive:** Add a "Complete/Archive" button to notes in the UI. 
*   **Agentic Delete (Visual):** When a note is archived via the UI, trigger a 3D animation where an agent walks to the note's destination, "picks it up", and walks to a 3D Trash Can or Vault mesh to dispose of it.

### Milestone 3: Obsidian-Style Tag Browser
**Goal:** Allow the user to find connections between their notes using the LLM-generated tags.
*   **The Tag Explorer:** Add a search icon to the bottom dock. When clicked, it opens a `.liquid-glass-strong` modal.
*   **Functionality:** The modal lists all unique tags currently existing in the database. Clicking a tag queries Supabase and displays a masonry grid of all notes containing that tag.

### Milestone 4: "Ask the Librarian" (RAG Chat Mode)
**Goal:** Allow the user to synthesize and chat with their stored knowledge.
*   **The Chat Toggle:** Add a UI toggle in the bottom dock to switch between "New Note" and "Ask AI".
*   **The Backend Route:** Create a new API route (`app/api/chat/route.ts`).
*   **The RAG Logic (Strict Grounding):** Fetch all user notes from Supabase. Feed them into the Vercel AI SDK (`gemini-2.5-flash`) as system context. **CRITICAL:** Use a system prompt and a temperature of `0` to enforce strict grounding. If the user asks a question that is not covered by the notes, the LLM must explicitly refuse to answer (e.g., "I couldn't find any notes related to that") instead of guessing or hallucinating from outside knowledge.

### Milestone 5: The Knowledge Graph (Obsidian-Style)
**Goal:** Visualize how different notes connect across categories.
*   **The Graph:** Add a "Graph View" button opening a full-screen `.liquid-glass` overlay.
*   **The Logic:** Use a lightweight network graph library (e.g., `react-force-graph-2d`). Represent notes as nodes, and draw link-lines between them if they share the same string in their `tags` array.

---

## 4. Phase 3 (Future Scope - DO NOT BUILD NOW)
These features are documented for architecture planning but are strictly out of scope for Phase 2:
- **Obsidian Integration:** Adding the ability to sync or export notes automatically to a local Obsidian vault (using browser File System Access API or a cloud-bridge solution).
- **3D Engine Overhaul:** Replacing the static voxel `.obj` files with high-fidelity, optimized glTF/GLB models.
- **Rigged Animations:** Replacing the sliding capsule robots with fully rigged models using Mixamo animations (walking, carrying, idle breathing).
- **Physical Interactions:** Animating the robots to physically interact with the environment (e.g., opening filing cabinet drawers).

---

## 5. Execution Rules for AI Agents
- **@writing-plans:** Always generate a step-by-step markdown plan before executing any Milestone. Wait for user approval.
- **Non-Destructive Coding:** Never delete or break the R3F 3D canvas, the pathfinding logic, or the base Supabase connection while building these UI overlays.
- **Component Modularity:** Break large UI additions into smaller, reusable React components inside `components/notelings/`.
- **Responsive Design:** The full SAMS 3-panel layout is primarily for desktop (`lg:` screens). On mobile, the 3D canvas should still take priority, but the right Kanban board should be hidden behind a UI toggle or placed in a bottom sheet to avoid overcrowding the screen.
- **Real-Time Data (CRITICAL):** For the Kanban board, do NOT use polling. Use Supabase's native `supabase.channel().on('postgres_changes', ...)` WebSockets. **CRITICAL REACT 18 RULE:** You MUST return a cleanup function in the `useEffect` that calls `supabase.removeChannel(channel)`. Failing to do this causes zombie channels in Strict Mode and will crash the app.
- **Terminal State Management:** Keep the event log array in Zustand lightweight. Limit it to the most recent 50-100 logs to prevent memory leaks and UI lag.
- **R3F Memory Management:** Do not manually call `unmountComponentAtNode` or force raw Three.js dispose methods unless handling raw GLTF loaders. Let React Three Fiber handle component unmounting naturally to avoid WebGL memory leaks.