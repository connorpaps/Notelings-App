# Full 3D Office Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the group-only tuner with a full development builder where every current office asset can be spawned, selected, transformed, duplicated, deleted, and exported.

**Architecture:** A client-side React context owns editable scene instances and a unique asset catalog derived from the existing placement definitions. The R3F scene renders those instances independently, attaching Drei `TransformControls` to the selected instance; a DOM builder panel shares the same context for catalog/category actions and transform editing. The existing static floor and procedural wall shell remain environment primitives, while the current furniture/decor placements are converted into the initial editable scene.

**Tech Stack:** Next.js App Router, React 19, React Three Fiber 9, Drei `TransformControls`, Three.js, TypeScript, localStorage.

## Global Constraints

- Preserve current asset loading behavior and the React 19/R3F cached-object clone rule.
- Do not mutate a shared cached OBJLoader with `setMaterials`; each placement maps its OBJ material names to its own MTL creator.
- Keep the floor, wall shell, lighting, and camera behavior intact unless required for builder interaction.
- Builder UI is development/admin tooling and is hidden from production builds.
- Use `npm`; do not add database/auth/physics dependencies.
- Keep transforms serializable as position/rotation/scale arrays so final scene data can be copied into `officeLayout.ts`.

---

### Task 1: Define builder state and catalog

**Files:**
- Create: `components/office/OfficeBuilderContext.tsx`
- Modify: `components/office/officeLayout.ts`
- Test: `components/office/officeLayout.test.ts`

- [ ] Export `BuilderCategory`, `BuilderAsset`, `BuilderTransform`, and `BuilderItem` types.
- [ ] Derive one catalog entry per unique OBJ/MTL pair from `PLACEMENTS`, categorizing paths into Seating, Cubicles, Tables, Electronics, Coffee, Plants, Utilities, Wall Decor, or Decor.
- [ ] Convert each current placement into an initial builder item with world-space position, `[0, rotationY, 0]` rotation, and unit scale; preserve wall offsets and elevation.
- [ ] Add context actions for spawn, select, update transform, duplicate, delete, clear, reset, and JSON export.
- [ ] Persist serializable builder items to localStorage with a versioned key and fall back to the initial layout when storage is empty/invalid.
- [ ] Add unit assertions for catalog uniqueness, category coverage, and initial item count.

### Task 2: Render editable scene items

**Files:**
- Create: `components/office/OfficeBuilderScene.tsx`
- Modify: `components/office/VoxelOffice.tsx`
- Modify: `components/office/OfficeModel.tsx`
- Modify: `components/office/CubicleDivider.tsx`
- Modify: `components/office/Walls.tsx`

- [ ] Render floor and wall segments as static shell primitives.
- [ ] Render all builder items under a named `office-builder-items` group, including current wall decor and TV assets.
- [ ] Add transform overrides, instance IDs, selection callbacks, and group refs to `OfficeModel` without reparenting cached loader results.
- [ ] Support the procedural T divider as a builder item so it can be selected/transformed as well.
- [ ] Attach `TransformControls` to the selected item in translate/rotate mode and update context transforms on object changes.
- [ ] Ensure `OrbitControls` is disabled while a gizmo drag is active and re-enabled afterward.
- [ ] Keep scene metadata for test auditing: instance ID, asset ID, category, selected state, and transform.

### Task 3: Build the overlay editor

**Files:**
- Create: `components/office/OfficeBuilderPanel.tsx`
- Modify: `app/page.tsx`
- Modify: `components/office/OfficeCanvas.tsx`
- Modify: `app/globals.css`

- [ ] Replace the Leva-only panel with a development-only full builder overlay.
- [ ] Add category tabs and asset cards with Spawn actions.
- [ ] Add a selected-object inspector with numeric position, rotation, and scale inputs.
- [ ] Add Translate/Rotate mode buttons, Duplicate, Delete, Reset Scene, Clear Scene, Export JSON, and Copy JSON actions.
- [ ] Add a scrollable scene list with selection and per-item deletion.
- [ ] Make the panel pointer-interactive while the rest of the overlay remains transparent to canvas interaction.
- [ ] Add concise instructions explaining click-to-select, gizmo dragging, and final JSON export.

### Task 4: Validate interaction contracts

**Files:**
- Modify: `e2e/office-smoke.spec.ts`
- Modify: `components/office/officeLayout.test.ts`

- [ ] Assert all initial placements render as builder instances with unique IDs.
- [ ] Assert catalog categories and builder panel labels exist.
- [ ] Assert one TV and one stand are present initially and no wall-decor duplication occurs.
- [ ] Assert selected item metadata and transform controls are available in the scene graph.
- [ ] Run `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
- [ ] Browser-test spawn, select, transform input, duplicate, delete, reset, and export controls.

### Task 5: Review and memory update

**Files:**
- Modify: `handoff.md`
- Modify: `knowledge.md`
- Modify: `docs/lessons-learned.md`

- [ ] Have the implementation reviewed for loader ownership, gizmo/orbit interaction, state persistence, and UI usability.
- [ ] Record the builder workflow and the final-export handoff process.
- [ ] Record any new R3F/TransformControls or localStorage gotchas.
