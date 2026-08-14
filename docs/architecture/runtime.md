# Runtime Architecture

Notelings is a Next.js App Router application whose product stage is a transparent React Three Fiber office. The UI is a light paper-and-glass control surface layered above that office.

## Active composition

```text
app/page.tsx
├── PaperWorldBackground        CSS light-paper surface and neutral vignette
├── OfficeCanvas                orthographic R3F canvas and render profile
│   └── NewOfficeScene
│       ├── NewOfficeModel      cloned GLB scene, recentered to world origin
│       └── AgentLayer           Blue/Green delivery robots + Red error sentinel
├── NotelingsUI                 accessible overlay and responsive controls
└── GridEditorPanel             hidden-by-default development navigation tool
```

The active office asset is `public/models/3D_Note_Office_2/3d_note_office.glb`. The previous OBJ office is historical material under `archive/legacy-office/` and is not imported by the released app.

## Note delivery flow

```text
Command Dock
  → POST /api/categorize or POST /api/notes for AI-off capture
  → authenticated server route validates origin, session, body, and limits
  → Gemini categorizes and extracts tags, or deterministic/manual fallback applies
  → Supabase writes an owner-scoped note through the server client
  → Zustand agent store enqueues a delivery task
  → dispatcher assigns the first idle Blue/Green agent
  → AgentRobot finds an orthogonal A* route on the baked 42×42 GLB grid
  → imperative frame motor carries the robot and note card to the staging cell
  → processing beat completes the task and updates note status
  → Realtime/API state updates the Spatial Board and terminal
  → toast confirms the delivery or degraded outcome
```

The Red agent is an error sentinel and is never assigned delivery work. Provider failure does not silently discard a note: the server/client degraded path preserves an Uncategorized outcome where persistence is available and signals the sentinel.

## Navigation

- Grid: 42×42 cells at 0.25 world units.
- Movement: four-directional A* with Manhattan heuristic.
- Safety: the generated blocked map owns the robot clearance contract; runtime curve checks reject unsafe smoothing and fall back to the orthogonal path.
- Frame loop: `AgentRobot` mutates Three.js refs and consumes frame distance; React/Zustand state changes occur at command boundaries, not per frame.
- Destination staging cells: Work `[22,37]`, Admin `[34,4]`, Uncategorized `[3,21]`, and trash `[27,8]`.

## Overlay contract

The app shell remains `absolute inset-0` and pointer-transparent where it crosses the canvas. Interactive panels/buttons explicitly opt back into `pointer-events-auto`. This keeps the office visible while preserving normal keyboard and pointer interaction for the control surface.

## Performance boundaries

- The GLB is preloaded and displays an in-scene loading state.
- High and balanced renderer profiles cap DPR at 1; balanced reduces shadow/SSAO cost for constrained devices.
- The knowledge graph uses a 2D canvas and freezes its force layout after warmup so it does not add a permanent physics loop beside R3F.
- Screenshot-only `preserveDrawingBuffer` and accelerated robot movement are enabled by Playwright configuration, not production runtime configuration.
