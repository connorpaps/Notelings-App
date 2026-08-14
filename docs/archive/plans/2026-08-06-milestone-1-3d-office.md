# Milestone 1: Static Isometric 3D Voxel Office — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js App Router + React Three Fiber app and assemble the static 3D voxel office (floor, walls, desks, chairs, bookshelves, decor) from the `public/models/3D_Office_Obj_Assets` OBJ/MTL pack, replicating `docs/references/preview.png`, viewed through an isometric orthographic camera.

**Architecture:** A data-driven scene. A single `components/office/officeLayout.ts` config (cell-grid based, intentionally shaped for Milestone 2's A* pathfinding) drives `<VoxelOffice/>`, which renders memoized `<OfficeModel/>` components that load OBJ+MTL via `useLoader`. The Canvas is an isometric orthographic camera with drei `OrbitControls` (dev), ambient + directional shadow lighting, a drei `Grid` floor, and walls/decor replicated from `preview.png`.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + ESLint; three.js + @react-three/fiber v9 + @react-three/drei v10; vitest (unit tests); @playwright/test (e2e smoke); npm.

## Global Constraints

- Project root: `G:/Notelings_App` (Windows; use bash syntax). All commands run from root.
- Package manager: **npm only** (never yarn/pnpm).
- Version pairing (verified): React 19 → `@react-three/fiber@^9`, `@react-three/drei@^10`, `three@latest`, `@types/three@latest`.
- Import three examples loaders via `three/addons/...` (e.g. `three/addons/loaders/OBJLoader.js`).
- All WebGL/three code behind a `'use client'` boundary; scene mounted with `next/dynamic(..., { ssr: false })`.
- Assets stay at `public/models/3D_Office_Obj_Assets/...` — never move/rename; public URL is `/models/3D_Office_Obj_Assets/...`.
- Y-up; y=0 is the floor; every model is normalized so its origin = bottom-center (see Task 3).
- Layout is **data-driven** in `components/office/officeLayout.ts` — the single source of truth that Milestone 2's nav grid consumes. Positions derive from integer cell coords (`x = col * CELL_SIZE`, `z = row * CELL_SIZE`) with a center offset.
- Apply skills during execution: `r3f-fundamentals`, `r3f-best-practices` (no state setters in `useFrame`; memoize; Suspense + preload), `vercel-react-best-practices` (App Router, dynamic import for the heavy scene), `impeccable`/`design-taste-frontend-v1` (page presentation).
- Do not modify `MEMORY_SETUP.md`, `MASTER_SPEC_FINAL.md`, `UI_PROMPTS.md`, the memory system files' structure, or any existing asset file.
- Out of scope for M1: agents, A* pathfinding, task queue, LLM, Supabase, the 2D UI overlay, physics, animations. Zustand/Supabase/zod are NOT installed in M1 (YAGNI).
- Validation gates before "done": `npm run build`, `npm run lint`, `npx vitest run`, `npx playwright test`, plus browser screenshot comparison to `docs/references/preview.png` with zero console errors.

---

### Task 1: Scaffold Next.js App Router app and install M1 dependencies

**Files:**
- Create (via create-next-app, copied from a temp dir): `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Keep (do NOT overwrite): `.gitignore`, `README.md` (GitHub's), `docs/`, `public/models/`, memory files
- Modify: `package.json` (add scripts + M1 deps)

**Why temp-dir scaffold:** create-next-app refuses non-empty directories. Scaffold into a sibling temp folder, copy generated files in, then install.

- [ ] **Step 1: Scaffold into a temp dir outside the repo**

```bash
cd /g/Notelings_App
rm -rf /g/notelings-scaffold-tmp
npx create-next-app@latest /g/notelings-scaffold-tmp --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Copy scaffold files into the project root (exclude repo-owned files)**

```bash
cd /g/notelings-scaffold-tmp
for f in package.json tsconfig.json next.config.ts next-env.d.ts postcss.config.mjs eslint.config.mjs; do cp -f "$f" /g/Notelings_App/; done
mkdir -p /g/Notelings_App/app
cp -rf app/* /g/Notelings_App/app/
# do NOT copy .gitignore, README.md, public/ (ours are authoritative)
cd /g/Notelings_App
rm -rf /g/notelings-scaffold-tmp
```

- [ ] **Step 3: Install runtime deps (M1 scope only)**

```bash
cd /g/Notelings_App
npm install
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

- [ ] **Step 4: Install test deps + browser**

```bash
npm install -D @playwright/test vitest
npx playwright install chromium
```

- [ ] **Step 5: Add npm scripts to `package.json`** (inside `"scripts"`)

```json
"test": "vitest run",
"test:e2e": "playwright test",
"lint": "eslint ."
```

(create-next-app already provides `dev`, `build`, `start`.)

- [ ] **Step 6: Verify scaffold**

Run: `npm run build`
Expected: clean build, no errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js App Router + M1 3D dependencies"
git add docs/activity-log.md && git commit -m "chore: sync activity log"   # hook appends after first commit
```

**Produces:** a compiling Next.js app with three/fiber/drei + vitest + Playwright installed; `npm run dev` serves the default page.

---

### Task 2: Layout config (`officeLayout.ts`) + unit test

**Files:**
- Create: `components/office/officeLayout.ts`
- Create: `components/office/officeLayout.test.ts`

**Interfaces:**
- Produces:
  - `const CELL_SIZE: number` — world units per grid cell (initial guess `1.2`, calibrated in Task 7; a 2×1 table OBJ spans ≈2.4×1.2 world units).
  - `const OFFICE_COLS / OFFICE_ROWS: number` — grid dimensions (initial 18×14, tuned in Task 7).
  - `type ModelPlacement = { id: string; name: string; obj: string; mtl: string; cell: [number, number]; rotationY?: number; scale?: number; elevationY?: number }`
  - `const PLACEMENTS: ModelPlacement[]` — every object in the office.
  - `const WALLS: { cell: [number, number]; lenCells: number; axis: 'x' | 'z'; height: number }[]` — wall segments (filled from preview in Task 7).
  - `function cellToWorld(col: number, row: number): [number, number]` — `[(col - OFFICE_COLS/2) * CELL_SIZE, (row - OFFICE_ROWS/2) * CELL_SIZE]`.
  - `const BLOCKED_CELLS: Set<string>` — `"${col},${row}"` keys for every furniture-occupied cell (Milestone 2 A* consumes this).

- [ ] **Step 1: Write the failing test** `components/office/officeLayout.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PLACEMENTS, WALLS, BLOCKED_CELLS, OFFICE_COLS, OFFICE_ROWS, cellToWorld } from './officeLayout'

const ROOT = join(process.cwd(), 'public') // repo-root public/ (vitest runs from project root)

describe('officeLayout', () => {
  it('has unique ids and non-empty names', () => {
    const ids = PLACEMENTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    PLACEMENTS.forEach((p) => expect(p.name.length).toBeGreaterThan(0))
  })

  it('keeps every placement and wall inside the grid bounds', () => {
    PLACEMENTS.forEach((p) => {
      expect(p.cell[0]).toBeGreaterThanOrEqual(0)
      expect(p.cell[0]).toBeLessThan(OFFICE_COLS)
      expect(p.cell[1]).toBeGreaterThanOrEqual(0)
      expect(p.cell[1]).toBeLessThan(OFFICE_ROWS)
    })
    WALLS.forEach((w) => {
      const end = w.axis === 'x' ? w.cell[0] + w.lenCells : w.cell[1] + w.lenCells
      expect(end).toBeLessThanOrEqual(w.axis === 'x' ? OFFICE_COLS : OFFICE_ROWS)
    })
  })

  it('references only real asset files', () => {
    PLACEMENTS.forEach((p) => {
      expect(existsSync(join(ROOT, p.obj))).toBe(true)
      expect(existsSync(join(ROOT, p.mtl))).toBe(true)
    })
  })

  it('marks every occupied cell as blocked for pathfinding', () => {
    PLACEMENTS.forEach((p) => expect(BLOCKED_CELLS.has(`${p.cell[0]},${p.cell[1]}`)).toBe(true))
  })

  it('maps cells to world coords around the grid center', () => {
    const [x, z] = cellToWorld(0, 0)
    const [cx, cz] = cellToWorld(OFFICE_COLS / 2, OFFICE_ROWS / 2)
    expect(cx).toBeCloseTo(0)
    expect(cz).toBeCloseTo(0)
    expect(x).toBeLessThan(0)
    expect(z).toBeLessThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/office/officeLayout.test.ts`
Expected: FAIL — `officeLayout.ts` does not exist yet.

- [ ] **Step 3: Write `components/office/officeLayout.ts`**

```ts
// Single source of truth for the M1 office layout.
// Milestone 2's A* nav grid consumes BLOCKED_CELLS and cellToWorld.

export const CELL_SIZE = 1.2 // world units per grid cell (calibrate in Task 7)
export const OFFICE_COLS = 18
export const OFFICE_ROWS = 14

export type ModelPlacement = {
  id: string
  name: string
  obj: string // public-relative path, e.g. /models/3D_Office_Obj_Assets/...
  mtl: string
  cell: [number, number] // [col, row]
  rotationY?: number // radians, multiples of Math.PI / 2
  scale?: number
  elevationY?: number // raise above floor (e.g. wall decor)
}

export type WallSegment = {
  cell: [number, number]
  lenCells: number
  axis: 'x' | 'z'
  height: number
  thickness?: number
}

// Seeded placement so the scene renders and tests pass from Task 2 onward;
// the full preview-faithful layout is added in Task 7.
export const PLACEMENTS: ModelPlacement[] = [
  {
    id: 'desk-seed',
    name: 'White 2x1 desk (seed)',
    obj: '/models/3D_Office_Obj_Assets/Tables/Office_Table_White_2x1_01.obj',
    mtl: '/models/3D_Office_Obj_Assets/Tables/Office_Table_White_2x1_01.mtl',
    cell: [8, 6],
  },
]

export const WALLS: WallSegment[] = [] // populated in Task 7 from preview.png analysis

/** Convert grid cell [col, row] to world [x, z] centered on the grid. */
export function cellToWorld(col: number, row: number): [number, number] {
  return [(col - OFFICE_COLS / 2) * CELL_SIZE, (row - OFFICE_ROWS / 2) * CELL_SIZE]
}

/** Every cell occupied by a piece of furniture — consumed by Milestone 2 A*. */
export const BLOCKED_CELLS: Set<string> = new Set(
  PLACEMENTS.filter((p) => p.elevationY === undefined || p.elevationY === 0).map(
    (p) => `${p.cell[0]},${p.cell[1]}`,
  ),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/office/officeLayout.test.ts`
Expected: PASS — the seeded `desk-seed` placement satisfies the id/file/bounds/blocked-cell assertions. `PLACEMENTS`/`WALLS` are extended in Task 7.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add data-driven office layout config + unit tests"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the typed layout config + validation tests that pin the contract Milestone 2 will reuse.

---

### Task 3: `<OfficeModel/>` — OBJ+MTL loader with normalization

**Files:**
- Create: `components/office/OfficeModel.tsx`

**Interfaces:**
- Consumes: `ModelPlacement` from Task 2.
- Produces: `<OfficeModel placement={placement} />` — renders the loaded, normalized OBJ group at its world position.

- [ ] **Step 1: Write `components/office/OfficeModel.tsx`**

```tsx
'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import type { ModelPlacement } from './officeLayout'
import { cellToWorld } from './officeLayout'

/**
 * Loads a MagicaVoxel OBJ + its MTL palette texture and normalizes it so the
 * group origin sits at the bottom-center of the model's bounding box. This
 * makes `cell`-based placement predictable regardless of raw OBJ offsets.
 */
function OfficeModel({ placement }: { placement: ModelPlacement }) {
  const { obj, mtl, cell, rotationY = 0, scale = 1, elevationY = 0 } = placement

  // 1) Materials — MTLLoader auto-resolves the MTL's relative map_Kd PNG path
  // against the MTL file's own directory (e.g. .../Tables/), which is exactly
  // where the PNGs live, so no setResourcePath is needed.
  const materials = useLoader(MTLLoader, mtl)

  // 2) Geometry with materials pre-injected
  const object = useLoader(OBJLoader, obj, (loader) => {
    loader.setMaterials(materials)
  })

  // 3) Normalize once: center on X/Z, floor on Y (origin = bottom-center)
  const normalized = useMemo(() => {
    if (!object) return null
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const group = new THREE.Group()
    group.add(object)
    object.position.set(-center.x, -box.min.y, -center.z)
    group.scale.setScalar(scale)
    group.position.set(0, elevationY, 0)
    return { group, size }
  }, [object, scale, elevationY])

  // 4) Dispose on unmount (R3F does NOT auto-dispose raw loader results)
  useEffect(() => {
    return () => {
      object.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mat = mesh.material as THREE.Material | THREE.Material[]
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat?.dispose()
        }
      })
    }
  }, [object])

  const [x, z] = cellToWorld(cell[0], cell[1])
  if (!normalized) return null

  return (
    <group position={[x, 0, z]} rotation-y={rotationY}>
      <primitive object={normalized.group} />
    </group>
  )
}

export default OfficeModel
```

> Note: `MTLLoader` resolves each MTL's relative `map_Kd <file>.png` against that MTL's own directory automatically (verified pattern). Only add `loader.setResourcePath(...)` in Task 7 if any texture fails to paint and lives outside its MTL's folder.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors (`three/addons` types resolve via `@types/three`).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add OBJ+MTL OfficeModel loader with normalization"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** a reusable, memo-friendly model loader that floors every asset at y=0 and centers it on its cell — the workhorse for all placements.

---

### Task 4: Floor and walls

**Files:**
- Create: `components/office/Floor.tsx`
- Create: `components/office/Walls.tsx`
- Modify: `components/office/officeLayout.ts` (wall/decor data populated in Task 7)

**Interfaces:**
- Produces: `<Floor />` (ground plane + drei Grid), `<Walls />` (renders `WALLS` as box segments + wall-decor placements with `elevationY`).

- [ ] **Step 1: Write `components/office/Floor.tsx`**

```tsx
'use client'
import { Grid } from '@react-three/drei'

export default function Floor() {
  return (
    <group>
      {/* Solid ground so shadows have something to land on */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#17181c" />
      </mesh>
      {/* Stylized grid overlay (isometric-friendly) */}
      <Grid
        position={[0, 0, 0]}
        args={[40, 40]}
        cellSize={1.2}
        cellThickness={0.6}
        cellColor="#2a2c33"
        sectionSize={6}
        sectionThickness={1.1}
        sectionColor="#3b3e47"
        fadeDistance={60}
        infiniteGrid
      />
    </group>
  )
}
```

- [ ] **Step 2: Write `components/office/Walls.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { WALLS, PLACEMENTS, cellToWorld, CELL_SIZE } from './officeLayout'
import OfficeModel from './OfficeModel'

/** Solid wall segments (replicated from preview.png; primitive boxes) + decor. */
export default function Walls() {
  const segments = useMemo(
    () =>
      WALLS.map((w) => {
        const [cx, cz] = cellToWorld(w.cell[0], w.cell[1])
        const length = w.lenCells * CELL_SIZE
        const isX = w.axis === 'x'
        return (
          <mesh
            key={`wall-${w.cell[0]}-${w.cell[1]}-${w.axis}`}
            position={isX ? [cx + length / 2, w.height / 2, cz] : [cx, w.height / 2, cz + length / 2]}
            rotation-y={isX ? 0 : Math.PI / 2}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[isX ? length : w.thickness ?? 0.2, w.height, isX ? w.thickness ?? 0.2 : length]} />
            <meshStandardMaterial color="#2e3138" />
          </mesh>
        )
      }),
    [],
  )

  const decor = useMemo(
    () =>
      PLACEMENTS.filter((p) => (p.elevationY ?? 0) > 0).map((p) => (
        <OfficeModel key={p.id} placement={p} />
      )),
    [],
  )

  return (
    <group>
      {segments}
      {decor}
    </group>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add grid floor and config-driven walls"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** floor + walls rendering from config (empty until Task 7 populates data).

---

### Task 5: `<VoxelOffice/>` assembly

**Files:**
- Create: `components/office/VoxelOffice.tsx`

**Interfaces:**
- Consumes: `PLACEMENTS` (Task 2), `<OfficeModel/>` (Task 3), `<Floor/>`/`<Walls/>` (Task 4).
- Produces: `<VoxelOffice />` — the full scene content (no Canvas yet).

- [ ] **Step 1: Write `components/office/VoxelOffice.tsx`**

```tsx
'use client'
import { Suspense, useMemo } from 'react'
import { Html } from '@react-three/drei'
import OfficeModel from './OfficeModel'
import Floor from './Floor'
import Walls from './Walls'
import { PLACEMENTS } from './officeLayout'

function LoadingFallback() {
  return (
    <Html center>
      <div style={{ color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 14, opacity: 0.7 }}>
        assembling office…
      </div>
    </Html>
  )
}

export default function VoxelOffice() {
  const furniture = useMemo(
    () =>
      PLACEMENTS.filter((p) => (p.elevationY ?? 0) === 0).map((p) => (
        <OfficeModel key={p.id} placement={p} />
      )),
    [],
  )

  return (
    <group>
      <Floor />
      <Walls />
      <Suspense fallback={<LoadingFallback />}>{furniture}</Suspense>
    </group>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: assemble VoxelOffice scene from layout config"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the scene content component that Maps config → meshes.

---

### Task 6: `OfficeCanvas` (isometric camera, lights) + page integration

**Files:**
- Create: `components/office/OfficeCanvas.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Produces: `<OfficeCanvas />` — full-viewport `<Canvas>` (orthographic isometric camera, ambient+directional shadow lights, `OrbitControls`, `frameloop="demand"`), rendering `<VoxelOffice/>`.
- Consumes: `<VoxelOffice/>` (Task 5).

- [ ] **Step 1: Write `components/office/OfficeCanvas.tsx`**

```tsx
'use client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import VoxelOffice from './VoxelOffice'

export default function OfficeCanvas() {
  return (
    <Canvas
      orthographic
      camera={{ position: [24, 22, 24], zoom: 38, near: -100, far: 300 }}
      shadows
      dpr={[1, 2]}
      frameloop="demand"
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera }) => camera.lookAt(0, 1.5, 0)}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Isometric-friendly lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[18, 26, 12]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <hemisphereLight args={['#bfd4ff', '#1c1e24', 0.35]} />
      <VoxelOffice />
      <OrbitControls
        enablePan
        enableZoom
        minZoom={10}
        maxZoom={120}
        target={[0, 1.5, 0]}
      />
    </Canvas>
  )
}
```

- [ ] **Step 2: Make the page a full-screen client scene** — `app/page.tsx`

```tsx
'use client'
import dynamic from 'next/dynamic'

// WebGL scene must not be SSR'd (three needs browser APIs)
const OfficeCanvas = dynamic(() => import('@/components/office/OfficeCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#8a8f98', fontFamily: 'system-ui' }}>
      loading 3D office…
    </div>
  ),
})

export default function Home() {
  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      <OfficeCanvas />
    </main>
  )
}
```

- [ ] **Step 3: Full-screen dark root** — `app/layout.tsx` (replace scaffolded boilerplate)

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Notelings — Second Brain Office',
  description: 'Gamified visual note organizer — 3D voxel office',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Global CSS** — `app/globals.css`

```css
@import 'tailwindcss';

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: #0e0f12;
  overflow: hidden;
  color-scheme: dark;
}
```

- [ ] **Step 5: Dev-server smoke check**

Run: `npm run dev`
Open: `http://localhost:3000`
Expected: full-screen dark page with the grid floor visible from an isometric angle; no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: isometric orthographic office canvas + full-screen page"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the running app milestone — a lit, isometric, interactive (orbit/pan/zoom) empty office shell.

---

### Task 7: Replicate `preview.png` — populate the layout

**Files:**
- Modify: `components/office/officeLayout.ts` (populate `PLACEMENTS` + `WALLS`)

**Interfaces:**
- Consumes: nothing new — uses the Task 2 types and `cellToWorld`.
- Produces: the fully populated layout matching `docs/references/preview.png` (also cross-check `public/models/3D_Office_Obj_Assets/preview_*.png` and `docs/references/reference_*.png`).

- [ ] **Step 1: Analyze the reference image with the browser tool**

```bash
npm run dev   # keep running
```

Spawn browser-use: open `file:///G:/Notelings_App/docs/references/preview.png` (and `preview_all.png`); report the layout: room shape/walls, desk clusters (which table/chair models, orientations, grid rows/cols), bookshelves (cabinets/organizers), lounge (couches, coffee tables), plants, wall decor positions, color scheme.

- [ ] **Step 2: Encode the layout into `officeLayout.ts`**

Translate the browser analysis into `PLACEMENTS` entries (furniture at `elevationY: 0`, decor at `elevationY > 0`) and `WALLS` segments (or `[]` if the preview is open-plan). Use only models that exist in `public/models/3D_Office_Obj_Assets`. Keep every placement on an integer cell. Example cluster (desk rows): desks at cells (3..6, 3), (3..6, 5), chairs in front at (3..6, 4) with `rotationY: Math.PI` to face the desk.

- [ ] **Step 3: Run layout unit tests**

Run: `npx vitest run`
Expected: PASS (ids unique, in-bounds, files exist, blocked cells marked).

- [ ] **Step 4: Visual iteration loop** (repeat until faithful)

1. `npm run dev` (ensure running).
2. Screenshot `http://localhost:3000` with browser-use.
3. Compare to `preview.png`; adjust cells/rotations/scales in `officeLayout.ts`; verify zero console errors each pass.
4. Tune `CELL_SIZE` (currently 1.2) if desk clusters visually overflow their cells; tune camera `zoom` for framing.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: assemble office layout matching preview.png"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the office visually matching the reference image, with zero console errors.

---

### Task 8: Playwright smoke/visual suite

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/office-smoke.spec.ts`

**Interfaces:**
- Consumes: running dev server (`npm run dev`).
- Produces: `npx playwright test` green; screenshots saved to `test-results/` (gitignored).

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```

- [ ] **Step 2: Write `e2e/office-smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('3D office renders without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  // Canvas mounts (dynamic import + WebGL init)
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Give loaders a moment to hydrate the scene
  await page.waitForTimeout(3_000)

  // A loaded MagicaVoxel model appears on the grid (the office is never empty in M1)
  expect(errors).toEqual([])

  await page.screenshot({ path: 'test-results/office-m1.png', fullPage: true })
})
```

- [ ] **Step 3: Run the suite**

Run: `npx playwright test`
Expected: PASS; `test-results/office-m1.png` written.

- [ ] **Step 4: Gitignore test output**

Verify `test-results/` is ignored; if not, append to `.gitignore`:
```gitignore
test-results/
playwright-report/
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: add Playwright smoke suite for 3D office"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** repeatable e2e verification that the scene mounts with zero console errors.

---

### Task 9: Final validation + memory system sync

**Files:**
- Modify: `knowledge.md` (real commands, replace `<!-- TODO: fill in -->` defaults), `handoff.md` (work completed), `.gitignore` if needed.

- [ ] **Step 1: Full validation gates**

```bash
npm run build
npm run lint
npx vitest run
npx playwright test
```
Expected: all green.

- [ ] **Step 2: Update `knowledge.md` Commands section**

Replace the `<!-- TODO: fill in -->` placeholders with the real scripts:
- Install: `npm install`
- Development: `npm run dev`
- Test: `npm test` (vitest)
- E2E: `npm run test:e2e` (playwright)
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Build: `npm run build`

Add architecture bullets: scene mounts via `next/dynamic({ ssr: false })`; layout single source of truth at `components/office/officeLayout.ts` (`CELL_SIZE`, `BLOCKED_CELLS` for M2 A*).

- [ ] **Step 3: Append "Work completed" to `handoff.md`**

Date-stamped entry: M1 delivered — scaffold, isometric orthographic canvas, preview-matched office layout, vitest + Playwright suites, validation results.

- [ ] **Step 4: Expand/clean `docs/lessons-learned.md`**

Add any lessons from implementation (e.g. create-next-app refuses non-empty dirs → temp-dir scaffold; MagicaVoxel OBJ origin normalization; `frameloop="demand"` + OrbitControls).

- [ ] **Step 5: Commit and push**

```bash
git add -A && git commit -m "docs: record M1 completion in memory system"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
git push
```

Expected: clean tree, all commits pushed to `origin/main`.

**Produces:** a validated, documented, pushed Milestone 1.
