# New 3D Office Swap (GLB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the active 3D office (legacy voxel/OBJ composition) with the new `3d_note_office.glb` model, re-mapping the robot navigation grid and all delivery destinations (Work/Admin/Uncategorized/Archive) to the new floor plan while preserving the legacy office code intact as a backup.

**Architecture:** The new office is a single 10.1×10.1 m Sketchfab-style GLB (clean glTF 2.0, no Draco, 22 embedded PNG/JPEG textures — `@react-three/drei`'s `useGLTF` loads it directly). We recenter the model to world origin, generate a static 42×42 @ 0.25 m navigation grid from the actual GLB geometry (walls, glass partitions, furniture in a 0–2.2 m band; door cutouts stay open because the doors were removed from the GLB), bake it into a TypeScript data module, and re-point the existing robot system (Zustand store, A* pathfinding, dispatcher, Terminal log) at the new grid and destinations. The legacy `VoxelOffice.tsx` is renamed `VoxelOffice_Legacy.tsx` and removed from the active `<Canvas>`; all its dependencies (`agentGrid.ts`, `officeLayout.ts`, `OfficeModel.tsx`, `officeBuilder*`, `Floor.tsx`, `officeAsset*`) stay untouched in the repo, and a git tag is the authoritative revert point.

**Tech Stack:** React/Next.js 16 (App Router, Tailwind v4), React Three Fiber + `@react-three/drei@10.7.8` (`useGLTF`), three 0.185 (`GLTFLoader` for the off-line grid generator), Zustand 5, A* pathfinding (`components/office/pathfinding.ts`, unchanged), vitest, Playwright.

## Global Constraints

- **Non-destructive (Phase 2 rule):** never delete or modify these legacy files — `VoxelOffice_Legacy.tsx` (renamed from `VoxelOffice.tsx`), `OfficeModel.tsx`, `Floor.tsx`, `agentGrid.ts`, `officeLayout.ts`, `officeBuilderDefault.ts`, `officeBuilderAssets.ts`, `officeAssetManifest.ts`, `officeAssetFootprints.ts`, `officeMode.ts`, `OfficeBuilderScene.tsx`. Their unit tests must stay green untouched.
- **Model path:** `public/models/3D_Note_Office_2/3d_note_office.glb` (18 MB, 696 meshes, 48 materials). Measured bbox: min `(-10.0901, -0.2376, -0.1234)`, max `(0.008, 2.0126, 10)`, center `(-5.041, 0.8875, 4.9383)`. Recenter offset applied to the scene: **`(5.041, 0, -4.9383)`** (x/z only; floor top at y=0).
- **Categories unchanged:** `Work | Admin | Uncategorized` (LLM contract, `lib/notes/categorization.ts` untouched). Destination keys stay `'whiteboard' | 'printer' | 'corkboard'` (`lib/notes/types.ts` untouched) — only their cells and display labels change.
- **New destination anchors (model coords → world → 42×42 cell):** `cell = round(world/0.25 + 21)`, `world = model + (5.041, -4.9383)`:
  - Work (Manager's Office bookshelf `(-5.32, 9.23)`) → world `(-0.28, 4.29)` → anchor cell `(20, 38)`
  - Admin (grey filing cabinets `(-1.2, 0.19)`) → world `(3.84, -4.75)` → anchor cell `(36, 2)`
  - Uncategorized (hallway bookshelf `(-9.88, 5.3)`) → world `(-4.84, 0.36)` → anchor cell `(2, 22)`
  - Archive (trash bin `(-3.68, 1.79)`) → world `(1.36, -3.15)` → anchor cell `(26, 8)`
  - Reception (green `Reception_4` desk `(-0.93, 4.88)`) → world `(4.11, -0.06)` → anchor cell `(37, 21)`
  - Doors (all open in GLB): big entrance `(-8.15, 0.9)` → cell `(9, 5)`; front-right door `(-2.74, 0.01)` → cell `(30, 1)`; left doors `(-10, 4.17)` → cell `(1, 18)` and `(-10, 6.40)` → cell `(1, 27)`.
- **Robot loop unchanged:** queue → robot walks directly to the category destination → 2 s processing → filed; archive = two-leg walk to destination then to the trash staging cell. NO Grab→Process→Store intermediate stops (user decision 2026-08-10).
- **Robot sizing:** body radius 0.38→**0.30**, capsule length 0.72→**0.62**, navigation clearance 0.22→**0.14** (effective width 0.88 m; narrowest doorway measured ≈0.92–0.95 m — verify with A* reachability tests, Task 8).
- **Camera:** keep position `[24, 22, 24]`; retune zoom **38→60** (initial) and target `[0, 1.5, 0]→[0, 1, 0]` so the 10.1 m office fills the frame at roughly the same visual size as the current 21.6×16.8 m office. Tune after visual screenshot; update the `OFFICE_RENDER_PROFILE`/camera E2E assertions to the final values.
- **UI labels** (user decision): `Work → "Manager's Bookshelf"`, `Admin → "Filing Cabinets"`, `Uncategorized → "Hallway Bookshelf"`. Update `TASK_DESTINATION_LABELS`, WelcomeScreen pills, and E2E text expectations.
- **Doors are walkable:** the GLB has no door leaves; the grid generator rasterizes wall/glass/furniture geometry only, so door cutouts are open by construction.
- **No new dependencies.** `npm`, `npx tsc --noEmit`, `npm test` (vitest), `npm run lint`, `npm run build`, `npm run test:e2e`.
- Cleanup: delete `app/office-preview/`, `public/_tmp_office_iso.png`, and every `scripts/_tmp_*.mjs` at the end.
- Commit per task (frequent, small). Revert point tag: `pre-new-office`.

---

### Task 0: Revert point + baseline

**Files:**
- None (git only)

**Interfaces:**
- Produces: git tag `pre-new-office` at the current HEAD.

- [x] **Step 1: Record baseline**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, and (dev server running) `npm run test:e2e`. Record: unit count (expect 149), tsc 0 errors, lint 0 errors, E2E 6/6.

- [x] **Step 2: Create the revert point**

```bash
git add -A -- . ':!2026-08-08 00-14-26.mp4'
git commit -m "chore: baseline before new GLB office swap" || true
git tag pre-new-office
git tag -l
```

Expected: tag `pre-new-office` exists; working tree clean except the known untracked `.mp4`.

---

### Task 1: GLB grid generator + baked blocked-cell data

**Files:**
- Create: `scripts/generate-new-office-grid.mjs`
- Create: `components/office/newOfficeGridData.ts` (generated output, committed)
- Create: `components/office/newOfficeLayout.ts` (constants the generator and runtime share)

**Interfaces:**
- Consumes: `public/models/3D_Note_Office_2/3d_note_office.glb`, `three`, `three/examples/jsm/loaders/GLTFLoader.js` (Node run — no browser).
- Produces:
  - `components/office/newOfficeLayout.ts` exports: `NEW_OFFICE_MODEL_PATH = '/models/3D_Note_Office_2/3d_note_office.glb'`; `NEW_OFFICE_RECENTER: readonly [number, number, number] = [5.041, 0, -4.9383]`; `NEW_OFFICE_GRID_COLS = 42`; `NEW_OFFICE_GRID_ROWS = 42`; `NEW_OFFICE_CELL_SIZE = 0.25`; `NEW_OFFICE_CLEARANCE = 0.14`; `NEW_OFFICE_ANCHORS` (see Global Constraints); `NEW_OFFICE_DESTINATION_ANCHOR_CELLS`.
  - `components/office/newOfficeGridData.ts` exports: `NEW_OFFICE_BLOCKED_CELLS: ReadonlySet<string>` (raw geometry raster, already inflated by `NEW_OFFICE_CLEARANCE`); `NEW_OFFICE_ASCII_MAP: readonly string[]` (42 rows × 42 chars, `#` blocked / `.` free, row 41 = back z+5.25, row 0 = front z−5.25, col 0 = left x−5.25).
  - `scripts/generate-new-office-grid.mjs` prints: rasterized ASCII map, per-material cell counts, doorway gap widths along the four shell walls, a list of every anchor cell with `FREE|BLOCKED|INFLATED` and its nearest free cell, and writes `newOfficeGridData.ts`.

- [x] **Step 1: Create `components/office/newOfficeLayout.ts`** (hand-written, committed in this task)

```ts
import type { GridTransform } from './pathfinding'

/** The new office model, loaded via drei useGLTF (clean glTF 2.0, no Draco). */
export const NEW_OFFICE_MODEL_PATH = '/models/3D_Note_Office_2/3d_note_office.glb'

/**
 * Measured GLB bbox center (model space): min (-10.0901,-0.2376,-0.1234),
 * max (0.008,2.0126,10). The scene is recentered by subtracting this (x/z
 * only); floor top is at y=0. Guarded by newOfficeLayout.test.ts (bbox drift).
 */
export const NEW_OFFICE_RECENTER: readonly [number, number, number] = [5.041, 0, -4.9383]

/** Navigation grid: 42×42 cells at 0.25 m, centered on world (0,0). */
export const NEW_OFFICE_GRID_COLS = 42
export const NEW_OFFICE_GRID_ROWS = 42
export const NEW_OFFICE_CELL_SIZE = 0.25
export const NEW_OFFICE_GRID_TRANSFORM: GridTransform = {
  origin: [0, 0],
  scale: [NEW_OFFICE_CELL_SIZE, NEW_OFFICE_CELL_SIZE],
  cols: NEW_OFFICE_GRID_COLS,
  rows: NEW_OFFICE_GRID_ROWS,
}

/** Robot center clearance (world units) for the new office (radius 0.30). */
export const NEW_OFFICE_CLEARANCE = 0.14

/** Key spots in MODEL coordinates (verified against the GLB geometry, 2026-08-10). */
export const NEW_OFFICE_ANCHORS = {
  workBookshelf: [-5.32, 9.23], // Manager's Office bookshelf (glass room, back-left corner)
  adminCabinets: [-1.2, 0.19], // grey filing cabinets, bottom-right wall
  hallwayBookshelf: [-9.88, 5.3], // IDEAS shelf between the two left-wall doors
  trashBin: [-3.68, 1.79], // black bin next to the wood desk near the front-right door
  receptionDesk: [-0.93, 4.88], // green Reception_4 desk
  bigEntrance: [-8.15, 0.9],
  frontRightDoor: [-2.74, 0.01],
  leftDoor1: [-10, 4.17],
  leftDoor2: [-10, 6.4],
} as const
```

- [x] **Step 2: Create `scripts/generate-new-office-grid.mjs`** (runs in Node; reuses the proven rasterizer from the M4 analysis — conservative per-triangle AABB + 0.07 m thickness, per-material y bands)

Key generator logic (full file in the task; this is the rasterizer core):

```js
// Node shims for GLTFLoader (browser-only image path):
globalThis.self = globalThis
class FakeImage { constructor() { this.width = 1; this.height = 1; this._s = '' } set src(v) { this._s = v; setTimeout(() => this.onload?.(), 0) } get src() { return this._s } }
globalThis.Image = FakeImage
globalThis.createImageBitmap = async () => ({ width: 1, height: 1 })

const CELL = 0.25, N = 42, OFF = -5.25, CX = -5.041, CZ = 4.9383, THICK = 0.07
// Material → y-band (model space): Glass blocks 0..2.2 (its panels span
// y 0.03..1.76; the 0.16 m lintels at y 1.83..1.98 are walk-under, ignored);
// everything else blocks 0.02..1.5 (desks/chairs/walls); hidden_material skipped.
const BANDS = { Glass: [0.02, 2.2], default: [0.02, 1.5] }
const raw = new Set() // "col,row"
// ... traverse gltf.scene; for each mesh (skip hidden_material), for each
// triangle whose y-span intersects the band, mark cells overlapping its
// x/z AABB (+THICK), in model space, converted to grid via worldToCell.
const worldToCell = (wx, wz) => [
  Math.max(0, Math.min(N - 1, Math.round((wx - CX) / CELL + N / 2 - 0.5) + 0)),
  Math.max(0, Math.min(N - 1, Math.round((wz - CZ) / CELL + N / 2 - 0.5) + 0)),
]
// Inflate raw by NEW_OFFICE_CLEARANCE (0.14) using the same algorithm as
// pathfinding.inflateBlockedCells, then emit:
//   export const NEW_OFFICE_BLOCKED_CELLS = new Set([...])  // ~700-1000 entries
//   export const NEW_OFFICE_ASCII_MAP = [ ...42 strings... ]
// Print doorway gap report: for each shell wall line (z≈0, z≈9.9, x≈-10, x≈0)
// and the interior glass lines (z≈1.75, z≈3.3, z≈6.99, x≈-6.35, x≈-5.43,
// x≈-2.10), report consecutive free-cell runs (these are the doors).
// Print anchor report: for every NEW_OFFICE_ANCHORS entry, the anchor cell,
// FREE|BLOCKED, and nearest free cell (ring scan).
```

- [x] **Step 3: Run the generator and inspect the report**

Run: `node scripts/generate-new-office-grid.mjs`

Expected: the ASCII map shows the hollow shell, interior glass partitions, and furniture; the doorways at the entrance `(9,5)`, front-right `(30,1)`, left doors `(1,18)`/`(1,27)` and the glass-room passage at z≈7 (x≈−6.4..−4.5) appear as **free-cell runs ≥ 3 cells wide** (≥0.75 m); all five anchors report a nearest free cell within 2 cells. If a glass partition is missing from the map, its y-band is wrong — fix `BANDS` and re-run.

- [x] **Step 4: Commit the generated data**

```bash
git add components/office/newOfficeLayout.ts components/office/newOfficeGridData.ts scripts/generate-new-office-grid.mjs
git commit -m "feat(office): generate 42x42 nav grid + baked blocked cells for the new GLB office"
```

---

### Task 2: New office scene (model loader + scene + canvas swap, legacy rename)

**Files:**
- Create: `components/office/NewOfficeModel.tsx`
- Create: `components/office/NewOfficeScene.tsx`
- Rename: `components/office/VoxelOffice.tsx` → `components/office/VoxelOffice_Legacy.tsx` (content unchanged except a header comment)
- Modify: `components/office/OfficeCanvas.tsx` (mount `<NewOfficeScene />` instead of `<VoxelOffice />`)

**Interfaces:**
- Consumes: `NEW_OFFICE_MODEL_PATH`, `NEW_OFFICE_RECENTER` (Task 1).
- Produces: `NewOfficeScene` — default-exported React component rendering the GLB + `<AgentLayer />` under a `<group name="new-office-scene" userData={{ notelingsNewOffice: true }}>`. Later tasks rely on the `new-office-scene` node name for E2E.

- [x] **Step 1: Create `components/office/NewOfficeModel.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { NEW_OFFICE_MODEL_PATH, NEW_OFFICE_RECENTER } from './newOfficeLayout'

/**
 * The 3D Note Office GLB. Cloned (never reparent the useGLTF cache — React 19
 * StrictMode empties it; see lessons) and recentered so the floor center sits
 * at world origin, matching the static navigation grid in newOfficeGridData.
 */
export default function NewOfficeModel() {
  const { scene } = useGLTF(NEW_OFFICE_MODEL_PATH)

  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      if (!object.isMesh) return
      // Opaque geometry casts; the floor and low furniture receive.
      const transparent = Array.isArray(object.material)
        ? object.material.some((m) => m.transparent)
        : object.material?.transparent
      object.castShadow = !transparent
      const box = new THREE.Box3().setFromObject(object)
      object.receiveShadow = box.min.y <= 0.05
    })
    return clone
  }, [scene])

  return <primitive object={model} position={[NEW_OFFICE_RECENTER[0], 0, NEW_OFFICE_RECENTER[2]]} />
}
```

- [x] **Step 2: Create `components/office/NewOfficeScene.tsx`**

```tsx
'use client'

import { Suspense } from 'react'
import NewOfficeModel from './NewOfficeModel'
import AgentLayer from './AgentLayer'

export default function NewOfficeScene() {
  return (
    <group name="new-office-scene" userData={{ notelingsNewOffice: true }}>
      <Suspense fallback={null}>
        <NewOfficeModel />
      </Suspense>
      <AgentLayer />
    </group>
  )
}
```

- [x] **Step 3: Rename the legacy office and remove it from the canvas**

```bash
git mv components/office/VoxelOffice.tsx components/office/VoxelOffice_Legacy.tsx
```

Prepend a header comment to `VoxelOffice_Legacy.tsx`:

```ts
// LEGACY office (M1–M4 voxel/OBJ composition). NOT mounted since the 2026-08-10
// GLB swap; kept intact as a backup (git tag `pre-new-office`). If re-enabled,
// re-point AgentLayer + agentDestinations at the legacy agentGrid modules.
```

In `components/office/OfficeCanvas.tsx`, change the import and the JSX:

```diff
- import VoxelOffice from './VoxelOffice'
+ import NewOfficeScene from './NewOfficeScene'
...
-      <VoxelOffice />
+      <NewOfficeScene />
```

- [x] **Step 4: Verify the scene compiles and the model loads in-browser**

Run: `npx tsc --noEmit` (0 errors), then open `http://localhost:3000` (dev server already running). Wait for the canvas; confirm in the browser console that no GLB/loader errors appear and `document.querySelector('canvas')` shows the office.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(office): mount the new GLB office scene; rename legacy VoxelOffice as backup"
```

---

### Task 3: New grid module + AgentLayer switch

**Files:**
- Create: `components/office/newOfficeGrid.ts`
- Modify: `components/office/AgentLayer.tsx` (import the new grid)

**Interfaces:**
- Consumes: `NEW_OFFICE_GRID_TRANSFORM`, `NEW_OFFICE_CLEARANCE`, `NEW_OFFICE_BLOCKED_CELLS` (Task 1); `findOpenStartCell`, `findFreeCell` from `pathfinding.ts` (untouched).
- Produces:
  - `newOfficeGrid.ts` exports: `NEW_OFFICE_AGENT_START_CELLS: Record<'blue' | 'green', GridCell>` (blue ≈ big entrance `(9,5)`, green ≈ front-right door `(30,1)`); `NEW_OFFICE_RED_START_CELL: GridCell` (≈ reception `(37,21)`); `NEW_OFFICE_EFFECTIVE_BLOCKED: ReadonlySet<string>` (the baked set as-is — it is already clearance-inflated).
- Modifies `AgentLayer` to use these; `__NOTELINGS_AGENTS__` now reports `gridCols: 42, gridRows: 42, gridResolution: 1` (new constant `NEW_OFFICE_GRID_RESOLUTION = 1`).

- [x] **Step 1: Create `components/office/newOfficeGrid.ts`**

```ts
import { findFreeCell, findOpenStartCell, type GridCell } from './pathfinding'
import {
  NEW_OFFICE_BLOCKED_CELLS,
  NEW_OFFICE_GRID_COLS,
  NEW_OFFICE_GRID_ROWS,
  NEW_OFFICE_GRID_TRANSFORM,
} from './newOfficeLayout'

/** Single-resolution grid (42×42 at 0.25 m) — no 2× supersampling needed. */
export const NEW_OFFICE_GRID_RESOLUTION = 1

const GRID_OPTS = { cols: NEW_OFFICE_GRID_COLS, rows: NEW_OFFICE_GRID_ROWS }

/** Spawn near the big entrance; green spawns near the front-right door. */
export const NEW_OFFICE_AGENT_START_CELLS: Record<'blue' | 'green', GridCell> = {
  blue: findOpenStartCell([9, 5], NEW_OFFICE_BLOCKED_CELLS, GRID_OPTS) ?? [9, 5],
  green: findFreeCell([30, 2], NEW_OFFICE_BLOCKED_CELLS, GRID_OPTS) ?? [30, 2],
}

/** Red error sentinel spawns beside the reception desk, away from the doorway. */
export const NEW_OFFICE_RED_START_CELL: GridCell =
  findFreeCell([37, 21], NEW_OFFICE_BLOCKED_CELLS, GRID_OPTS) ?? [37, 21]

/** Baked + clearance-inflated blocked set (see newOfficeGridData.ts). */
export const NEW_OFFICE_EFFECTIVE_BLOCKED = NEW_OFFICE_BLOCKED_CELLS

export { NEW_OFFICE_GRID_TRANSFORM as NEW_OFFICE_GRID_TRANSFORM }
```

(If `findOpenStartCell([9,5])` resolves to a different cell because `(9,5)` sits inside a desk cluster, keep the resolved value — the tests in Task 8 assert reachability, not exact spawn parity.)

- [x] **Step 2: Update `AgentLayer.tsx`**

Replace the `agentGrid` import with the new module and update every reference:

```diff
- import { AGENT_GRID_RESOLUTION, AGENT_GRID_TRANSFORM, AGENT_START_CELLS, RED_START_CELL, buildAgentBlockedCells } from './agentGrid'
+ import {
+   NEW_OFFICE_GRID_RESOLUTION,
+   NEW_OFFICE_GRID_TRANSFORM,
+   NEW_OFFICE_AGENT_START_CELLS,
+   NEW_OFFICE_RED_START_CELL,
+   NEW_OFFICE_EFFECTIVE_BLOCKED,
+ } from './newOfficeGrid'
```

- `const effectiveBlocked = useMemo(() => buildAgentBlockedCells(), [])` → `const effectiveBlocked = NEW_OFFICE_EFFECTIVE_BLOCKED` (drop `useMemo`; it is a module constant).
- `RED_START_CELL` → `NEW_OFFICE_RED_START_CELL`; `AGENT_START_CELLS[id]` → `NEW_OFFICE_AGENT_START_CELLS[id]`.
- `AGENT_GRID_TRANSFORM.cols/rows` → `NEW_OFFICE_GRID_TRANSFORM.cols/rows`; `gridResolution: AGENT_GRID_RESOLUTION` → `NEW_OFFICE_GRID_RESOLUTION`.
- Add a one-line comment: `// Active grid: the new GLB office (42×42 @ 0.25 m). Legacy agentGrid is preserved for the pre-new-office backup.`

- [x] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm test` (legacy `agentGrid.test.ts` still passes — it tests the untouched legacy module).

- [x] **Step 4: Commit**

```bash
git add components/office/newOfficeGrid.ts components/office/AgentLayer.tsx
git commit -m "feat(office): point AgentLayer at the new GLB office grid"
```

---

### Task 4: Destination remap (`agentDestinations.ts`)

**Files:**
- Modify: `components/office/agentDestinations.ts` (full rewrite)
- Modify: `components/office/agentDestinations.test.ts` (rewrite)
- Verify: `components/office/agentStore.ts` needs NO changes (it imports `TASK_DESTINATIONS`, `TASK_DESTINATION_LABELS`, `TRASH_STAGING_CELL`, types only).

**Interfaces:**
- Consumes: `NEW_OFFICE_GRID_TRANSFORM`, `NEW_OFFICE_AGENT_START_CELLS`… (Task 3); `GridCell`, `worldToGridCell` from `pathfinding.ts`; `TaskDestination` from `@/lib/notes/types`.
- Produces (public API unchanged shape): `TASK_DESTINATIONS: Record<TaskDestination, GridCell>`, `TASK_DESTINATION_LABELS: Record<TaskDestination, string>`, `TRASH_STAGING_CELL: GridCell`, `TASK_DESTINATION_ANCHORS: Record<TaskDestination, GridCell>`, `AgentId`, `TaskDestination` re-export. Removed: the `WORK_WHITEBOARD_*`/`CORKBOARD_*`/`TRASH_*` locked-item validators and exports (no legacy items in the new office) — grep the repo for importers before removing (`grep -rn "LOCKED_ITEM_ID" components lib e2e` must only hit the test file being rewritten).

- [x] **Step 1: Rewrite `components/office/agentDestinations.ts`**

```ts
import type { TaskDestination } from '@/lib/notes/types'
import type { GridCell } from './pathfinding'
import { worldToGridCell } from './pathfinding'
import { NEW_OFFICE_GRID_TRANSFORM, NEW_OFFICE_ANCHORS } from './newOfficeLayout'

// Re-exported so scene code keeps one import surface; the type itself lives in
// the light shared module so the server route never drags in the scene.
export type { TaskDestination } from '@/lib/notes/types'

export type AgentId = 'blue' | 'green' | 'red'

/**
 * Staging cells for the 3D Note Office (validated against the generated
 * blocked map in Task 1 — each is the nearest free cell in front of the
 * destination furniture; final values locked in Step 2 of this task).
 */
export const TASK_DESTINATIONS: Record<TaskDestination, GridCell> = {
  whiteboard: [20, 37], // Manager's Bookshelf — one cell in front of anchor (20,38)
  printer: [35, 3], // Filing Cabinets — one cell in front of anchor (36,2)
  corkboard: [3, 22], // Hallway Bookshelf — one cell in front of anchor (2,22)
}

export const TASK_DESTINATION_LABELS: Record<TaskDestination, string> = {
  whiteboard: "Manager's Bookshelf",
  printer: 'Filing Cabinets',
  corkboard: 'Hallway Bookshelf',
}

/** Walkable staging cell beside the trash bin (anchor (26,8)); the M2
 *  agentic-delete flow disposes archived notes here. */
export const TRASH_STAGING_CELL: GridCell = [26, 9]

/** World anchors used to keep destination cells tied to the GLB geometry. */
export const TASK_DESTINATION_ANCHORS: Record<TaskDestination, GridCell> = {
  whiteboard: worldToGridCell(
    NEW_OFFICE_ANCHORS.workBookshelf[0],
    NEW_OFFICE_ANCHORS.workBookshelf[1],
    NEW_OFFICE_GRID_TRANSFORM,
  ),
  printer: worldToGridCell(
    NEW_OFFICE_ANCHORS.adminCabinets[0],
    NEW_OFFICE_ANCHORS.adminCabinets[1],
    NEW_OFFICE_GRID_TRANSFORM,
  ),
  corkboard: worldToGridCell(
    NEW_OFFICE_ANCHORS.hallwayBookshelf[0],
    NEW_OFFICE_ANCHORS.hallwayBookshelf[1],
    NEW_OFFICE_GRID_TRANSFORM,
  ),
}
```

- [x] **Step 2: Lock the staging cells against the generated map**

Run a one-off check (temporary vitest test or a `node -e` with the baked data): for each of the 4 staging cells assert `!NEW_OFFICE_BLOCKED_CELLS.has(cell)` and `findPath(start, cell, { blocked, cols: 42, rows: 42 })` is non-null from both blue and green starts. If a staging cell is blocked, move it one cell toward open floor (the anchor report from Task 1 lists the nearest free cell) and update `TASK_DESTINATIONS`/`TRASH_STAGING_CELL`. Record the final values in the file comment.

- [x] **Step 3: Rewrite `components/office/agentDestinations.test.ts`**

Tests to include (concrete):

```ts
import { describe, expect, it } from 'vitest'
import {
  TASK_DESTINATIONS,
  TASK_DESTINATION_LABELS,
  TASK_DESTINATION_ANCHORS,
  TRASH_STAGING_CELL,
} from './agentDestinations'
import {
  NEW_OFFICE_BLOCKED_CELLS,
  NEW_OFFICE_GRID_COLS,
  NEW_OFFICE_GRID_ROWS,
} from './newOfficeLayout'
import { findPath, gridCellToWorld } from './pathfinding'

const GRID_OPTS = { blocked: NEW_OFFICE_BLOCKED_CELLS, cols: NEW_OFFICE_GRID_COLS, rows: NEW_OFFICE_GRID_ROWS }

describe('new-office task destinations', () => {
  it('maps the three categories to new-office staging cells', () => {
    expect(TASK_DESTINATIONS.whiteboard).toEqual([20, 37]) // Manager's Bookshelf
    expect(TASK_DESTINATIONS.printer).toEqual([35, 3]) // Filing Cabinets
    expect(TASK_DESTINATIONS.corkboard).toEqual([3, 22]) // Hallway Bookshelf
  })

  it('exposes the new descriptive labels', () => {
    expect(TASK_DESTINATION_LABELS).toEqual({
      whiteboard: "Manager's Bookshelf",
      printer: 'Filing Cabinets',
      corkboard: 'Hallway Bookshelf',
    })
  })

  it('keeps every staging cell free on the baked blocked map', () => {
    for (const cell of Object.values(TASK_DESTINATIONS)) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${cell[0]},${cell[1]}`)).toBe(false)
    }
    expect(NEW_OFFICE_BLOCKED_CELLS.has(`${TRASH_STAGING_CELL[0]},${TRASH_STAGING_CELL[1]}`)).toBe(false)
  })

  it('reaches every destination from the blue start (A* connectivity)', () => {
    const start = [9, 5] as const
    for (const [key, goal] of Object.entries(TASK_DESTINATIONS)) {
      const path = findPath([...start] as [number, number], goal, GRID_OPTS)
      expect(path, `${key} should be reachable`).not.toBeNull()
    }
    expect(findPath([...start] as [number, number], TRASH_STAGING_CELL, GRID_OPTS)).not.toBeNull()
  })

  it('derives anchors from the GLB coordinates through the new transform', () => {
    expect(TASK_DESTINATION_ANCHORS.whiteboard).toEqual([20, 38])
    expect(TASK_DESTINATION_ANCHORS.printer).toEqual([36, 2])
    expect(TASK_DESTINATION_ANCHORS.corkboard).toEqual([2, 22])
  })

  it('places the staging cell within one cell of its anchor (visible delivery)', () => {
    for (const [key, anchor] of Object.entries(TASK_DESTINATION_ANCHORS)) {
      const staging = TASK_DESTINATIONS[key as keyof typeof TASK_DESTINATIONS]
      const distance = Math.abs(staging[0] - anchor[0]) + Math.abs(staging[1] - anchor[1])
      expect(distance).toBeLessThanOrEqual(2)
      // And the staging cell must not be inside the furniture anchor cell.
      expect(staging.join(',')).not.toBe(anchor.join(','))
    }
  })

  it('keeps destination world positions inside the 42×42 grid', () => {
    for (const cell of [...Object.values(TASK_DESTINATIONS), TRASH_STAGING_CELL]) {
      const [x, z] = gridCellToWorld(cell, { origin: [0, 0], scale: [0.25, 0.25], cols: NEW_OFFICE_GRID_COLS, rows: NEW_OFFICE_GRID_ROWS })
      expect(Math.abs(x)).toBeLessThanOrEqual(5.26)
      expect(Math.abs(z)).toBeLessThanOrEqual(5.26)
    }
  })
})
```

- [x] **Step 4: Run and commit**

Run: `npx vitest run components/office/agentDestinations.test.ts` (pass), then `git add components/office/agentDestinations.ts components/office/agentDestinations.test.ts && git commit -m "feat(office): remap robot destinations to the new GLB office (Manager's Bookshelf, Filing Cabinets, Hallway Bookshelf)"`.

---

### Task 5: Robot scale-down + clearance prop

**Files:**
- Modify: `components/office/AgentRobot.tsx`
- Modify: `components/office/AgentLayer.tsx` (pass the new clearance)

**Interfaces:**
- Consumes: `NEW_OFFICE_CLEARANCE` (Task 1).
- Produces: `AgentRobot` gains an optional prop `clearanceWorld?: number` (default `ROBOT_NAVIGATION_CLEARANCE`); it is used in the two path-safety calls inside the command effect (`isPathSafe` and `createSafePathCurve`). Body constants shrink: `BODY_RADIUS 0.38→0.30`, `BODY_LENGTH 0.72→0.62`, `FACE_Z 0.42→0.36`, `NOTE_Z 0.56→0.5` (NOTE_X stays 0.28, NOTE_Y/FACE_Y derive from `BODY_Y` as today). `WALK_SPEED_WORLD`, `TURN_SPEED`, waypoint epsilon unchanged.

- [x] **Step 1: Edit `AgentRobot.tsx` constants**

```diff
- const BODY_RADIUS = 0.38
+ const BODY_RADIUS = 0.3
...
- const BODY_LENGTH = 0.72
+ const BODY_LENGTH = 0.62
...
- const FACE_Z = 0.42
+ const FACE_Z = 0.36
...
- const NOTE_Z = 0.56
+ const NOTE_Z = 0.5
```

`BODY_Y = BODY_RADIUS + BODY_LENGTH / 2` recomputes automatically (0.61). `FACE_Y = BODY_Y + 0.4` (1.01), `NOTE_Y = BODY_Y + 0.46` (1.07). No other constant changes.

- [x] **Step 2: Add the `clearanceWorld` prop**

```diff
 type AgentRobotProps = {
   agentId: AgentId
   start: GridCell
   blocked: BlockedSet
   grid: GridTransform
   color?: string
   name?: string
   /** How long an error state persists before auto-recovery (M4: red sentinel uses a longer window). */
   errorRecoveryDelayMs?: number
+  /** Center clearance used for path-safety sweeps; defaults to the shared
+   *  constant (legacy). The new office passes NEW_OFFICE_CLEARANCE (0.14). */
+  clearanceWorld?: number
 }
...
 const AgentRobot = function AgentRobot({
   agentId,
   start,
   blocked,
   grid,
   color = DEFAULT_BODY_COLOR,
   name = `agent-robot-${agentId}`,
   errorRecoveryDelayMs = ERROR_RECOVERY_DELAY,
+  clearanceWorld = ROBOT_NAVIGATION_CLEARANCE,
 }: AgentRobotProps) {
```

Replace the two hard-coded uses in the command effect:

```diff
     const safePath = isPathSafe(path, grid, blocked, {
-      clearanceWorld: ROBOT_NAVIGATION_CLEARANCE,
+      clearanceWorld,
     })
...
     curveRef.current = createSafePathCurve(path, grid, blocked, {
-      clearanceWorld: ROBOT_NAVIGATION_CLEARANCE,
+      clearanceWorld,
       startWorld: [group.position.x, group.position.z],
     })
```

Add `clearanceWorld` to the effect's dependency array. (The `ROBOT_NAVIGATION_CLEARANCE` import stays — it remains the default.)

- [x] **Step 3: Pass the new clearance from `AgentLayer.tsx`**

```diff
         <AgentRobot
           key={agentId}
           agentId={agentId}
           start={agentId === 'red' ? NEW_OFFICE_RED_START_CELL : NEW_OFFICE_AGENT_START_CELLS[agentId]}
           blocked={effectiveBlocked}
           grid={NEW_OFFICE_GRID_TRANSFORM}
           color={agents[agentId].color}
           name={`agent-robot-${agentId}`}
           errorRecoveryDelayMs={agentId === 'red' ? 5000 : undefined}
+          clearanceWorld={NEW_OFFICE_CLEARANCE}
         />
```

- [x] **Step 4: Verify**

Run: `npx tsc --noEmit`, `npm test`. In the browser, confirm the robots are visibly smaller and still navigate (see Task 10 for the full walk).

- [x] **Step 5: Commit**

```bash
git add components/office/AgentRobot.tsx components/office/AgentLayer.tsx
git commit -m "feat(office): scale robots down for the new office; per-scene clearance prop"
```

---

### Task 6: Camera re-frame

**Files:**
- Modify: `components/office/OfficeCanvas.tsx` (camera constants only; lights unchanged initially)

**Interfaces:**
- Consumes: nothing new.
- Produces: updated `CAMERA_ZOOM`, `CAMERA_TARGET`; the exported `OFFICE_RENDER_PROFILE` and `__NOTELINGS_CAMERA_PROFILE__` reflect the new values (E2E Task 9 asserts them).

- [x] **Step 1: Update the camera constants**

```diff
- const CAMERA_TARGET: [number, number, number] = [0, 1.5, 0]
- const CAMERA_ZOOM = 38
+ const CAMERA_TARGET: [number, number, number] = [0, 1, 0]
+ const CAMERA_ZOOM = 60
```

- [x] **Step 2: Visually verify framing**

Take a Playwright screenshot of `/` (iso view) at 1600×900. The 10.1 m office should fill roughly the same screen area the legacy 21.6×16.8 m office did (office depth ≈ 60–75% of viewport height, entrance visible at the bottom, back wall near the top). Adjust `CAMERA_ZOOM` ±10% and/or `CAMERA_TARGET` y (0.8–1.2) until it looks balanced; record the final values.

- [x] **Step 3: Commit**

```bash
git add components/office/OfficeCanvas.tsx
git commit -m "feat(office): re-frame the isometric camera for the new 10m office"
```

---

### Task 7: WelcomeScreen destination pills

**Files:**
- Modify: `components/notelings/WelcomeScreen.tsx`

**Interfaces:**
- Consumes: `TASK_DESTINATION_LABELS` text (Task 4) — keep in sync by hand (pills use static labels).

- [x] **Step 1: Update the pills**

```diff
 import { motion } from 'framer-motion'
- import { Pin, Printer, Sparkles, StickyNote } from 'lucide-react'
+ import { Archive, BookMarked, Library, Sparkles } from 'lucide-react'
 import GlassPanel from './GlassPanel'

 const DESTINATION_PILLS = [
-   { label: 'Whiteboard', icon: StickyNote },
-   { label: 'Printer', icon: Printer },
-   { label: 'Corkboard', icon: Pin },
+   { label: "Manager's Bookshelf", icon: BookMarked },
+   { label: 'Filing Cabinets', icon: Archive },
+   { label: 'Hallway Bookshelf', icon: Library },
 ]
```

- [x] **Step 2: Verify + commit**

Run: `npx tsc --noEmit`, `npm run lint`. Then `git add components/notelings/WelcomeScreen.tsx && git commit -m "feat(ui): rename welcome destination pills for the new office"`.

---

### Task 8: Grid invariant tests

**Files:**
- Create: `components/office/newOfficeGrid.test.ts`
- Create: `components/office/newOfficeLayout.test.ts` (bbox drift guard — parses the GLB in Node with the same shims as the generator)

**Interfaces:**
- Consumes: `NEW_OFFICE_BLOCKED_CELLS`, `NEW_OFFICE_GRID_TRANSFORM`, `NEW_OFFICE_RECENTER`, `NEW_OFFICE_AGENT_START_CELLS`, `NEW_OFFICE_RED_START_CELL`, `TASK_DESTINATIONS`, `TRASH_STAGING_CELL`, `findPath`.

- [x] **Step 1: Create `components/office/newOfficeGrid.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { NEW_OFFICE_AGENT_START_CELLS, NEW_OFFICE_RED_START_CELL } from './newOfficeGrid'
import { NEW_OFFICE_BLOCKED_CELLS, NEW_OFFICE_GRID_COLS, NEW_OFFICE_GRID_ROWS } from './newOfficeLayout'
import { TASK_DESTINATIONS, TRASH_STAGING_CELL } from './agentDestinations'
import { findPath } from './pathfinding'

const OPTS = { blocked: NEW_OFFICE_BLOCKED_CELLS, cols: NEW_OFFICE_GRID_COLS, rows: NEW_OFFICE_GRID_ROWS }

describe('new office grid invariants', () => {
  it('is a 42×42 grid with a sane blocked-cell population', () => {
    expect(NEW_OFFICE_GRID_COLS).toBe(42)
    expect(NEW_OFFICE_GRID_ROWS).toBe(42)
    expect(NEW_OFFICE_BLOCKED_CELLS.size).toBeGreaterThan(400) // walls + furniture
    expect(NEW_OFFICE_BLOCKED_CELLS.size).toBeLessThan(1500) // still mostly open floor
  })

  it('leaves the four known doorways open', () => {
    for (const cell of [[9, 5], [30, 1], [1, 18], [1, 27]] as const) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${cell[0]},${cell[1]}`), `door ${cell} should be free`).toBe(false)
    }
  })

  it('spawns all robots on free cells', () => {
    for (const cell of [...Object.values(NEW_OFFICE_AGENT_START_CELLS), NEW_OFFICE_RED_START_CELL]) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${cell[0]},${cell[1]}`)).toBe(false)
    }
  })

  it('keeps every robot start connected to every destination', () => {
    const goals = [...Object.values(TASK_DESTINATIONS), TRASH_STAGING_CELL]
    for (const start of [...Object.values(NEW_OFFICE_AGENT_START_CELLS), NEW_OFFICE_RED_START_CELL]) {
      for (const goal of goals) {
        expect(findPath(start, goal, OPTS), `start ${start} -> ${goal}`).not.toBeNull()
      }
    }
  })

  it('keeps the glass-room bookshelf reachable through the z≈7 doorway', () => {
    // Work anchor (20,38) sits behind the glass partition line; the path must
    // cross the doorway at x≈-6.4..-4.5 (world x≈-1.4..0.6, cells 15..23).
    const path = findPath([9, 5], TASK_DESTINATIONS.whiteboard, OPTS)
    expect(path).not.toBeNull()
    const crossesDoorway = path!.some(([col]) => col >= 15 && col <= 23)
    expect(crossesDoorway, 'path should cross the glass doorway row band').toBe(true)
  })
})
```

- [x] **Step 2: Create `components/office/newOfficeLayout.test.ts`** (bbox drift guard)

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { NEW_OFFICE_MODEL_PATH, NEW_OFFICE_RECENTER } from './newOfficeLayout'

// Node shims so GLTFLoader can parse the GLB without a browser (same as
// scripts/generate-new-office-grid.mjs).
;(globalThis as Record<string, unknown>).self = globalThis
class FakeImage { width = 1; height = 1; private srcValue = ''; set src(v: string) { this.srcValue = v; setTimeout(() => (this as unknown as { onload?: () => void }).onload?.(), 0) } get src() { return this.srcValue } }
;(globalThis as Record<string, unknown>).Image = FakeImage
;(globalThis as Record<string, unknown>).createImageBitmap = async () => ({ width: 1, height: 1 })

const PUBLIC_MODEL_PATH = NEW_OFFICE_MODEL_PATH.replace(/^\//, 'public/')

function measureCenter(): THREE.Vector3 {
  const loader = new GLTFLoader()
  let center: THREE.Vector3 | null = null
  loader.parse(
    readFileSync(PUBLIC_MODEL_PATH).buffer as ArrayBuffer,
    '',
    (gltf) => {
      gltf.scene.updateMatrixWorld(true)
      center = new THREE.Box3().setFromObject(gltf.scene).getCenter(new THREE.Vector3())
    },
    (error) => { throw error },
  )
  if (!center) throw new Error('GLB parse produced no scene')
  return center
}

describe('new office layout constants', () => {
  it('matches the GLB bbox center (recenter offset stays in sync with the grid)', () => {
    const c = measureCenter()
    expect(c.x).toBeCloseTo(-NEW_OFFICE_RECENTER[0], 1)
    expect(c.z).toBeCloseTo(-NEW_OFFICE_RECENTER[2], 1)
  })
})
```

(If `loader.parse` proves flaky under vitest's async handling, wrap it in a Promise and `await` it. Run this test with `npx vitest run components/office/newOfficeLayout.test.ts`.)

- [x] **Step 3: Run the full unit suite**

Run: `npm test` — all tests pass, including legacy `agentGrid.test.ts`, `officeLayout.test.ts`, `officeAssetAudit.test.ts`, `officeBuilderDefault.test.ts` (untouched legacy modules) and the new grid tests.

- [x] **Step 4: Commit**

```bash
git add components/office/newOfficeGrid.test.ts components/office/newOfficeLayout.test.ts
git commit -m "test(office): new-office grid invariants + GLB bbox drift guard"
```

---

### Task 9: E2E updates (`e2e/office-smoke.spec.ts`)

**Files:**
- Modify: `e2e/office-smoke.spec.ts`

**Interfaces:**
- Consumes: final `CAMERA_ZOOM`/`CAMERA_TARGET` (Task 6), final staging cells (Task 4), labels (Task 4).

- [x] **Step 1: Update the baseline test**

- Replace the `EXPECTED_IDS`/`MODEL_IDS` wait (which scans for `LOCKED_DEFAULT_ITEMS` names) with a wait for the new scene:

```ts
await page.waitForFunction(() => {
  const scene = (window as unknown as { __NOTELINGS_SCENE__?: SceneObject }).__NOTELINGS_SCENE__
  const find = (root: SceneObject | undefined, name: string): SceneObject | undefined => {
    if (root?.name === name) return root
    for (const child of root?.children ?? []) {
      const match = find(child, name)
      if (match) return match
    }
    return undefined
  }
  const count = (root: SceneObject): number =>
    (root.isMesh ? 1 : 0) + (root.children ?? []).reduce((total, child) => total + count(child), 0)
  const office = find(scene, 'new-office-scene')
  return Boolean(office && count(office) > 0)
}, { timeout: 60_000, polling: 500 })
```

- In the `audit` evaluate: `lockedScenePresent` → assert `find(scene, 'new-office-scene')` present and `find(scene, 'locked-office-scene')` **false** (legacy not mounted); `camera` expectation → the final Task 6 values (e.g. `[24, 22, 24, 60, -100, 300]`); `cameraProfile` → matching target/zoom; `configured` (shadow/material audit over `MODEL_IDS`) → **remove** (the GLB's materials are `MeshStandardMaterial` from the loader, not the legacy `notelingsLightingConfigured` userData) and replace with a simpler assertion that the office scene contains meshes with materials of type `MeshStandardMaterial`/`MeshBasicMaterial` and `castShadow` is set on at least one mesh.
- Keep: `builderScenePresent === false`, `gridDebugPresent === false`, pixel ratio 1, tone mapping exposure 1.2, ambient/key intensities (unchanged lights), shadow 4096, background frame contract, corner-pixel alpha 0, robot-part assertions (update face position deltas: `facePosition.z` closeTo **0.36**, `facePosition.y - bodyPosition.y` closeTo **0.4**, note card hidden while idle).

- [x] **Step 2: Update the dispatch test**

```diff
-  expect(arrivalTargets).toEqual(expect.arrayContaining([[29, 4], [30, 13]]))
+  expect(arrivalTargets).toEqual(expect.arrayContaining([[20, 37], [35, 3]]))
```

(Use the final staging cells from Task 4. The `destination` key assertions `'printer'`/`'whiteboard'` stay — keys are unchanged.)

- [x] **Step 3: Update the degraded test**

```diff
-      && Object.values(runtime.agents).some((agent) => (agent.lastArrivedTarget?.[0] ?? -1) === 27 && (agent.lastArrivedTarget?.[1] ?? -1) === 4))
+      && Object.values(runtime.agents).some((agent) => (agent.lastArrivedTarget?.[0] ?? -1) === 3 && (agent.lastArrivedTarget?.[1] ?? -1) === 22))
```

- [x] **Step 4: Update the archive test**

The trash staging assertion is implicit (toast + terminal); no cell assertion exists there — no change needed unless the terminal text changes (it does not: `archived "..."` + `Note archived — ... filed it in the trash.` come from store/useArchiveToasts, unchanged).

- [x] **Step 5: Run E2E**

Dev server running: `npm run test:e2e`. All 6 specs pass (tag-explorer and librarian-chat are UI-level and should be unaffected — if any destination text leaked into their assertions, fix the expectation).

- [x] **Step 6: Commit**

```bash
git add e2e/office-smoke.spec.ts
git commit -m "test(e2e): update office smoke specs for the new GLB office"
```

---

### Task 10: Full validation + visual walk

**Files:** none (validation only)

- [x] **Step 1: Static checks**

Run in parallel: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`. All green (0 errors; lint may keep its pre-existing 159 warnings).

- [x] **Step 2: E2E suite**

Run: `npm run test:e2e` — 6/6.

- [x] **Step 3: Visual walk-through (Playwright screenshots)**

Script `scripts/_tmp_visual_walk.mjs`: load `/`, dismiss the welcome, submit one note per category (mock `/api/categorize` to return Work/Admin/Uncategorized deterministically), and capture screenshots at: dispatch, mid-walk (robot crossing the entrance), at each destination, and during an archive two-leg walk (mock notes + Archive action). Verify:
1. The GLB renders with textures (wood floor, green walls, glass) — no black/missing materials, no console errors.
2. Robots are visibly smaller but readable; the note card is still legible.
3. Robots path through the doorways (entrance + glass-room passage) without clipping walls.
4. The office fills the frame like the legacy office did.
5. The trash walk ends at the bin (screenshot the archive-final leg).

If a robot fails to reach a destination (status flips to `error`), check the terminal/`__NOTELINGS_AGENTS__` diagnostics and revisit Task 1's map + Task 4's staging cells (systematic-debugging: never tune blindly — reproduce, read the rasterized map, then adjust clearance/robot radius or add a targeted access pocket).

- [x] **Step 4: Commit any fixes from the walk**

```bash
git add -A
git commit -m "fix(office): polish robot navigation / visuals after visual walk"
```

---

### Task 11: Cleanup + docs + final commit

**Files:**
- Delete: `app/office-preview/page.tsx`, `app/office-preview/` (dir), `public/_tmp_office_iso.png`, all `scripts/_tmp_*.mjs`
- Modify: `docs/activity-log.md`, `docs/lessons-learned.md`, `handoff.md`, `knowledge.md` (session protocol)
- Modify: `DESIGN.md` / `PRODUCT.md` only if they describe the 3D office destinations/look (check for "Whiteboard", "Printer", "Corkboard", "voxel office" mentions and update to the new office).

- [x] **Step 1: Remove temp artifacts**

```bash
git rm -r app/office-preview
rm -f public/_tmp_office_iso.png
git rm scripts/_tmp_*.mjs 2>/dev/null || rm -f scripts/_tmp_*.mjs
```

- [x] **Step 2: Update memory docs**

- `docs/activity-log.md`: append the swap summary (legacy preserved at `VoxelOffice_Legacy.tsx`, tag `pre-new-office`, new grid/destinations).
- `knowledge.md`: replace the office/destination paragraphs (M3/M4 sections) with the new office facts: GLB path, 42×42 @ 0.25 m grid, destination mapping table, robot scale, camera zoom 60, door/gap notes.
- `handoff.md`: append "Work completed" for this session.
- `DESIGN.md`/`PRODUCT.md`: update destination names if present.

- [x] **Step 3: Final checks + commit**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run test:e2e`. Then:

```bash
git add -A
git commit -m "docs: new GLB office swap memory updates; remove temp preview tooling"
git log --oneline -12
```

---

## Self-Review

**Spec coverage:**
- 0.1 revert point → Task 0 ✓
- Legacy preserved (rename, keep intact, off-canvas) → Task 2 ✓ (plus git tag)
- `useGLTF` loader + orthographic camera kept → Tasks 2 + 6 ✓
- New 2D grid with walkable doors → Task 1 + 8 (doors verified open by rasterizing geometry) ✓
- Waypoint remap (Work/Admin/IDEAS→Uncategorized/Archive/Reception) → Task 4 ✓ (IDEAS slot repurposed for Uncategorized per user decision)
- Zustand/Supabase sync + Terminal logs preserved → Task 4 keeps `agentStore.ts` untouched; labels drive log text ✓
- UI otherwise unchanged; robot scale tunable → Task 5 ✓
- Thorough testing → Tasks 8–10 (unit invariants + reachability, E2E, visual walk) ✓

**Placeholder scan:** staging cells `[20,37]`/`[35,3]`/`[3,22]`/`[26,9]` are initial values that Task 4 Step 2 locks against the generated blocked map with a defined procedure and tests — not a TBD. Camera zoom 60 is an initial value re-tuned visually in Task 6 with the final value asserted in Task 9 — not a TBD.

**Type consistency:** `NEW_OFFICE_GRID_TRANSFORM` is defined in `newOfficeLayout.ts` (Task 1) and imported by `newOfficeGrid.ts` (Task 3), `agentDestinations.ts` (Task 4), `AgentLayer.tsx` (Task 3) — single definition. `NEW_OFFICE_CLEARANCE` (0.14) is used by the generator inflation (Task 1), `AgentRobot` prop (Task 5), and tests. `AgentId`/`TaskDestination` re-exports keep their existing names.
