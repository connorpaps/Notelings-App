# Knowledge Graph UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Knowledge Graph overlay reliably closable, visually distinct from the office, stable while hovering, and easier to select.

**Architecture:** Keep `react-force-graph-2d` and the frozen layout unchanged. Use a transparent full-screen overlay with a bounded `bg-black/25 backdrop-blur-md` surface around the graph, fix stacking at the overlay boundary, separate explicit tag-focus dimming from transient pointer hover, and enlarge/color the custom canvas renderer plus pointer hit regions.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, `react-force-graph-2d`, Playwright.

## Global Constraints

- Do not restart or replace the already-running development server.
- Preserve the frozen layout contract: `warmupTicks={250}` and `cooldownTicks={0}`.
- Preserve the existing Bloom liquid-glass visual language and robot-palette identity colors.
- Keep graph interactions inside the existing overlay; no package or schema changes.
- Validate with `npx tsc --noEmit`, focused Vitest, focused Playwright, and `npm run lint`.

---

### Task 1: Stabilize overlay layering and stage background

**Files:**
- Modify: `components/notelings/KnowledgeGraphOverlay.tsx`
- Modify: `app/globals.css`
- Test: `e2e/knowledge-graph.spec.ts`

- [ ] Add an inset graph surface with `bg-black/25 backdrop-blur-md`; leave the full-screen overlay transparent so only the graph area blurs the office behind it.
- [ ] Place the canvas above the stage but below the header using explicit stacking classes.
- [ ] Place the header above the canvas with `relative z-20`, and keep the close button `pointer-events-auto` with a visible hover background.
- [ ] Extend the E2E flow to click `Close knowledge graph`, assert the dialog unmounts, reopen it, and assert the graph stage is visible.

### Task 2: Remove transient hover dimming

**Files:**
- Modify: `components/notelings/KnowledgeGraphCanvas.tsx`

- [ ] Make `focusedTag` the only source of graph-wide dimming; `hoveredId` should only change the hovered node’s local emphasis.
- [ ] Keep explicit tag-focus connected-edge dimming and the existing focus pill behavior.
- [ ] Ensure moving over blank canvas or between nodes does not change opacity for unrelated nodes.

### Task 3: Improve node visibility and hit targets

**Files:**
- Modify: `components/notelings/KnowledgeGraphCanvas.tsx`
- Test: `e2e/knowledge-graph.spec.ts`

- [ ] Render note satellites with larger category-colored cores and a soft category-colored ring; use a larger radius on hover.
- [ ] Increase note pointer hit radius and add comfortable padding around tag-label hit regions.
- [ ] Preserve category colors from `CATEGORY_GRAPH_COLOR`, accessible canvas interaction, and frozen positions.
- [ ] Keep the existing E2E note-click flow, which verifies a note hit opens the side peek.

### Task 4: Validate and record the fix

**Files:**
- Modify: `handoff.md`
- Modify: `knowledge.md`
- Modify: `docs/lessons-learned.md`

- [ ] Run focused graph unit tests, TypeScript, lint, and the single-worker Knowledge Graph E2E spec against the running app.
- [ ] Run the code review agent and fix any material findings.
- [ ] Append a dated Work completed note to `handoff.md` immediately after the substantial code change.
- [ ] Record the stacking and hover-state lessons with symptom, root cause, fix, avoidance rule, and fixed status.
