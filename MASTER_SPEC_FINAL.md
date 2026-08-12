> ⚠️ **STATUS — PARTIALLY SUPERSEDED (2026-08-12).** Still the architectural source of truth, but two sections are stale:
> - **§3 Asset pipeline** — the office is no longer the `.obj` voxel pack; it is the **GLB** `public/models/3D_Note_Office_2/3d_note_office.glb` (swapped 2026-08-10 — a Phase-3 "3D Engine Overhaul" pulled forward at the user's request). The legacy `.obj` assembly is preserved in `VoxelOffice_Legacy.tsx`.
> - **§9 Roadmap** — Milestones 1–4 are **complete**; Phase 2 (see `PHASE_2_SPEC_FINAL_UPDATED.md`) M1–M4 are complete and M5 (Knowledge Graph) is next.
> §5 schema, §6 edge cases, and §7 non-goals still hold (see `CURRENT_STATE.md` for the one §6 nuance: the pathfinding "emergency reset" has no "Lounge"/teleport).

# MASTER SPEC: Spatial "Second Brain" Agent Organizer (FINAL)

***ATTENTION AI CODING AGENT (GPT-5.6 / CLAUDE / ETC):*** 
*By reading this document, you are instructed to automatically assume the context, workflows, and strict guidelines of the installed skills listed in Section 8. You must apply them proactively without waiting for user prompts.*

## 1. Project Overview
**Concept:** A gamified, visual "Second Brain" and note organizer inspired by the Spatial Agentic Management System (SAMS). 
**Core Loop:** 
1. The user inputs notes into a 2D UI "Inbox".
2. A backend LLM categorizes the notes and returns a JSON object.
3. In a 3D isometric view, a Global Task Queue assigns the note to an available "Librarian" agent.
4. The assigned agent physically walks the note to the appropriate bookshelf/category area in the virtual office. 

## 2. Tech Stack & Tools
*   **Frontend UI:** React / Next.js (App Router).
*   **3D Engine:** React Three Fiber (R3F) / Three.js.
*   **Backend:** Next.js API Routes (Serverless).
*   **Database:** Supabase (Postgres).
*   **LLM Provider:** Google Gemini API / Groq API.

## 3. Asset Pipeline & Visual Style (The Agents & Office)
*   **Environment (The Voxel Office):** The office environment is built using modular `.obj` assets from the "3D Voxel Office Pack" by MariaIsMe. 
    *   **AI ACTION (Scene Assembly):** Read the `public/models/3D_Office_Obj_Assets` folder. You will find subfolders for `Chairs`, `Cubicles`, `Misc`, and `Tables`. Build a `<VoxelOffice />` R3F component to recreate the layout shown in `docs/references/preview.png`. 
    *   *Specifically:* Load a floor plane, assemble outer walls using `Office_Misc_Wall_*`, place a main working area using `Office_Table_*` and `Office_Chair_*`, and set up destination "bookshelves" using `Office_Misc_Cabinet_*` or `Office_Misc_Organizer`.
*   **Agents (Code Generated):** Hyper-casual, capsule-shaped primitives. 
    *   **Body:** A smooth `<capsuleGeometry>` using `meshStandardMaterial`. The body color reflects the agent's identity (e.g., Blue, Green, Red).
    *   **The LCD Face:** A flat `<planeGeometry>` slightly protruding from the head. This acts as a digital screen.
    *   **Expressive State:** Map the agent's Zustand state to its facial expression using emissive textures or simple canvas-drawn textures. 
        *   `IDLE` =  `^ ^` (Happy/Resting)
        *   `PROCESSING` =  `- -` (Thinking/Loading)
        *   `WALKING` = `O O` (Active/Focused)
        *   `ERROR` = `X X` (Error/Blocked)

## 4. Advanced Architecture: Pathfinding & Concurrency
*   **Pathfinding:** 2D Grid-Based A* (A-Star) overlaid on the 3D floor to navigate around voxel desk obstacles. Smooth `lerp` movement via R3F `useFrame`.
*   **Task Queue:** Zustand global state dispatcher. Assigns notes from a queue to the first available `IDLE` agent.

---

## 5. Data Schema & Environment Variables

### A. Database Schema (Supabase Postgres)
For the MVP, only one core table is required. Agents and Queue live in client-side memory (Zustand).
**Table: `notes`**
*   `id`: UUID (Primary Key, Default: `uuid_generate_v4()`)
*   `content`: TEXT (The raw input from the user)
*   `category`: VARCHAR (The LLM-assigned bucket, e.g., 'Ideas', 'Finance', 'Work')
*   `tags`: TEXT[] (Array of strings extracted by LLM)
*   `status`: VARCHAR (e.g., 'pending', 'categorized', 'archived' - Default: 'pending')
*   `created_at`: TIMESTAMPTZ (Default: `now()`)

### B. Required Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_generative_ai_api_key
```

---

## 6. Edge Cases & Error Handling
To ensure a robust MVP, the AI must implement the following fallbacks:
*   **LLM API Timeout/Failure:** If the API fails to respond within 10s, catch the error. Show a toast notification to the user, and change the Red Agent's state to `ERROR` (pulsing red glow, `X X` face). Save the note locally as "Uncategorized".
*   **Pathfinding Failure (Stuck Agent):** If the A* algorithm fails to find a valid path to a bookshelf, trigger an emergency reset: the agent drops the note, teleports back to the "Lounge", and resets to `IDLE`. 
*   **Massive Text Input:** Add client-side validation using `zod` to limit the input text to a maximum of 1,000 characters to prevent LLM token overflow.

---

## 7. Out of Scope (Non-Goals)
**DO NOT BUILD THESE FEATURES (Feature Creep Prevention):**
*   **No Authentication:** MVP is single-user and local/browser-session based. Do not build login/signup screens or user tables.
*   **No Physics/Colliders:** Do not install Cannon.js, Rapier, or write collision logic. Movement is strictly coordinate-based lerping (A* grid).
*   **No Rigged Animations:** Do not attempt to use Mixamo, bone rigging, or walking leg animations. The capsule robots will simply slide/float across the floor.
*   **No Multi-User Sync:** Zustand state does not need to sync via WebSockets to other browsers.

---

## 8. AI Agent Skills & Workflow Integration
**[CRITICAL INSTRUCTIONS FOR AI]:** The workspace is equipped with specific agent skills via `skills.sh` and `.cursorrules`. You must natively integrate these into your workflow at all times:

### A. The Baseline Mindset (Always Active)
*   **`ponytail` (@dietrichgebert):** *Default Mode.* You are a lazy senior developer. Write the absolute minimum code necessary. Choose the simplest native solution before reaching for complex architectures. YAGNI. 
*   **`impeccable` & `design-taste-frontend-v1`:** *Default UI Mode.* Never output ugly, default HTML elements. Use excellent spacing, modern typography, and clean aesthetic taste automatically.

### B. Planning & Setup (Before Coding)
*   **`domain-modeling`:** Use this to perfectly scaffold the Supabase schema based on Section 5.
*   **`writing-plans` & `executing-plans`:** For any feature taking more than 20 lines of code, write a step-by-step markdown plan first.

### C. Framework Execution (During Coding)
*   **`vercel-react-best-practices`:** Strictly enforce Next.js App Router patterns.
*   **`shadcn`:** Use this for all 2D UI elements.
*   **`r3f-fundamentals` & `r3f-best-practices`:** Use declarative Three.js properly. **NEVER** put heavy calculations or React state setters inside a `useFrame` loop. 
*   **`supabase-postgres-best-practices`:** Write secure queries and strict RLS policies.

### D. Refactoring & Debugging (When Things Go Wrong)
*   **`systematic-debugging`:** If pathing breaks, DO NOT guess. Stop, add `console.log` tracers, isolate the variables, and debug methodically.
*   **`improve-codebase-architecture`:** Proactively suggest separating massive R3F files into modular components.

---

## 9. Development Roadmap (MVP Milestones)

**Milestone 1: The Static 3D Room (Engine Foundation)**
*   **Goal:** Set up the Next.js App Router, React Three Fiber `<Canvas>`, and an Orthographic (isometric) camera. 
*   **CRITICAL AI ACTION:** Read the `docs/references/preview.png` image and the nested `.obj` files in the `public/models/3D_Office_Obj_Assets` folder (`Chairs`, `Cubicles`, `Misc`, `Tables`). Programmatically assemble the `preview.png` layout in code using these pieces.
*   **Verification:** Run `npm run dev` and see the beautifully lit, assembled 3D room.
*   *AI Action:* Apply `r3f-fundamentals` and `vercel-react-best-practices`.

**Milestone 2: The "Puppet" Robots (Pathfinding & Movement)**
*   **Goal:** Code the `<AgentRobot />` primitives. The robot must have an LCD screen face that changes expressions (e.g., `^ ^`, `O O`) based on state. Define the 2D grid array mapping the floor obstacles. Implement the A* pathfinding algorithm with a temporary click-to-move testing function.
*   **Verification:** User clicks the floor; the robot smoothly lerps around desks to reach the target, and its face changes expression while moving.
*   *AI Action:* Apply `ponytail` (keep math simple) and `r3f-best-practices` (efficient `useFrame` lerping).

**Milestone 3: The "Brain" (Task Queue & Dispatcher)**
*   **Goal:** Set up Zustand global state (`TaskQueue`, `Agents`). Spawn 3-4 robots in a Lounge. Write the Dispatcher loop that watches the queue, assigns tasks to `IDLE` robots, and routes them to bookshelf coordinates.
*   **Verification:** Manually push dummy tasks in code and watch multiple robots wake up, change facial expressions to `PROCESSING`, and execute deliveries simultaneously.
*   *AI Action:* Use `writing-plans` to outline state flow before executing.

**Milestone 4: The Interface & LLM (Core Loop Integration)**
*   **Goal:** Connect the 3D engine to the user. Build the 2D glassmorphism UI over the canvas. Connect the Next.js API route to Gemini/Groq. Wire the UI submit button to trigger the LLM, save to Supabase, and push to the Zustand queue.
*   **CRITICAL AI ACTION:** Read the `UI_PROMPTS.md` file in the root directory. You MUST build the 2D React UI exactly according to the adapted MotionSites prompts provided in that file. **Also read the reference layout images in `docs/references/` (e.g., `sams-ui-layout.jpg`)** to perfectly replicate the transparent sidebar and bottom-dock structure. Ensure the UI uses `absolute inset-0 z-10 pointer-events-none`.
*   **Verification:** User types a real note in the UI -> LLM categorizes it -> Robot face changes to active (`O O`), visually delivers it -> Database saves it.