# Milestone 5: The Knowledge Graph (Bipartite Hub Model)

## 1. Goal
Build the visual capstone of the Notelings "Second Brain": a dynamic, interactive network graph of all notes and tags. 

## 2. Core Architecture: The Bipartite Data Model
To prevent the graph from becoming a useless "hairball" of lines, we will **not** connect Note A to Note B. 
Instead, we will build a **Bipartite Graph**:
*   **Node Type 1 (Tag Hubs):** Unique tags extracted from all notes (e.g., `#react`, `#finance`).
*   **Node Type 2 (Note Satellites):** The individual notes.
*   **Edges:** Lines are drawn ONLY between a Note Node and a Tag Node. 
*   **Result:** The force-directed physics engine will naturally pull notes with multiple tags into the space *between* those tag hubs, instantly visualizing topical clusters without overwhelming the screen with edges.

## 3. Tech Stack & Performance
*   **Library:** `react-force-graph-2d`
*   **Why 2D Canvas?** We already have a heavy WebGL context running at `z-10` (React Three Fiber). Using an HTML5 `<canvas>` for the graph prevents WebGL context loss and saves GPU memory.
*   **Physics Freezing (CRITICAL):** To keep the app running at 60fps and prevent the graph physics from fighting R3F for CPU, configure the graph to pre-calculate its layout and then freeze (e.g., using `warmupTicks={100}` and setting `cooldownTicks={0}` or `d3AlphaDecay`). The user should be able to pan/zoom smoothly without active physics calculations running in the background.

## 4. Aesthetics: The "Neural Glass" Look
The graph must adhere to the Phase 2 `.liquid-glass` aesthetic.

### Overlay Background
*   The graph lives in a full-screen `z-20` overlay with a deep translucent black background (`bg-black/60 backdrop-blur-md`). The 3D R3F office should be dimmed but vaguely visible behind it.

### Node & Edge Rendering (`nodeCanvasObject`)
*   **Tag Hubs:** Render as clean white text (Poppins font). No circles, just the text.
*   **Note Satellites:** Render as small, dim gray dots (`#888`).
*   **Edges:** Very thin, low-opacity white lines (`rgba(255,255,255,0.1)`).

### Interaction (Hover Focus)
*   When the user hovers over a node, highlight it and its connected edges.
*   Color the highlighted Note Node based on its underlying Category:
    *   `WORK`: Blue (`#2fa8e0`)
    *   `ADMIN`: Green (`#43c98b`)
    *   `IDEAS` / `Uncategorized`: Red (`#ef4444`)
*   Fade the opacity of all non-connected nodes and edges to 10% to create a clean visual focus.

## 5. UX: The "Side-Peek" Editor
*   When a user clicks a Note Node, **do not** close the graph or open a screen-blocking modal.
*   Instead, slide open a `.liquid-glass-strong` panel on the right side of the screen (similar to the Kanban board behavior). 
*   This panel allows the user to read, edit, or archive the clicked note while maintaining their visual context within the graph.
*   Updating tags in this side-panel should trigger a re-calculation of the graph data.

## 6. Execution Rules for AI Agents (CRITICAL)
1. **Skill Integration:** You MUST apply the `impeccable-design-taste-frontend-v1`, `vercel-react-best-practices`, and `shadcn` skills when building this UI overlay.
2. **Planning:** You MUST use the `writing-plans` skill to generate a step-by-step markdown plan for how you will transform the Zustand/Supabase note data into the `nodes` and `edges` arrays required by `react-force-graph-2d`.
3. **Execution:** Wait for user approval on the plan. Once approved, use the `executing-plans` skill to write the code.
4. **Non-Destructive Coding:** Do not break the R3F canvas or the background loop while building this modal.