# Milestone 2: Agent Robots & A* Pathfinding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one blue capsule "Librarian" robot with an LCD face to the released office, and let the user click any walkable floor cell so the robot smoothly lerps along a 2D-grid A* path around the furniture — while preserving the Milestone 1 static-diorama rendering baseline.

**Architecture:** A pure, unit-tested grid layer (`worldToCell` inverse mapping + A* + a blocked-cell merge) feeds a new `<AgentRobot />` primitive (capsule body + camera-facing CanvasTexture LCD face) driven by a tiny imperative handle. A new `<AgentLayer />` renders an invisible clickable nav floor and wires clicks → grid cell → A* path → robot movement. Movement runs only while animating: the robot calls R3F's `setFrameloop('always')` on `moveTo` and returns to `setFrameloop('demand')` + `invalidate()` on arrival, so the idle scene keeps its demand-rendering GPU savings. Agent state is a plain local type now with callback seams (used by Milestone 3's Zustand store later); no new dependencies.

**Tech Stack:** React 19, React Three Fiber 9 (`useThree.setFrameloop`, `useFrame`, primitives), Three.js 0.185 (`CapsuleGeometry`, `CanvasTexture`), Drei (`Line` for the dev-only path preview), TypeScript, Vitest, Playwright. No new packages.

## Global Constraints

- Package manager: **npm only**. **No new dependencies for M2.** (zustand 5.0.14 is already in `node_modules` transitively via R3F v9 — do NOT import it; M3 promotes it to `package.json` as a direct dependency.)
- Preserve the locked M1 visual baseline: fixed orthographic camera `[24,22,24]`/zoom 38, `frameloop="demand"` at rest, 4096² shadows, SSAO 32/4 @ intensity 2.0, exposure 1.2, ACES, the `<EffectComposer>` chain, and `OfficeLockedScene` untouched. Agent work is **additive**: a sibling `<AgentLayer />` mounted only in the non-builder branch of `VoxelOffice`.
- Do not touch `OfficeModel.tsx` / loader code (never reparent `useLoader` results; per-placement clone rules stay).
- `BLOCKED_CELLS`, `cellToWorld`, `OFFICE_COLS/ROWS`, `CELL_SIZE` remain the M2 grid contract. Only **add** `worldToCell` to `officeLayout.ts`; do not change existing exports or the `officeLayout.test.ts` existing assertions (the new inverse test is additive).
- Movement is coordinate-based lerp only — **no physics, no colliders, no rigged animations** (MASTER_SPEC_FINAL.md §7).
- Any direct Three.js mutation under demand rendering must explicitly `invalidate()`. The frameloop must return to `'demand'` after every walk; never leave `'always'` running when the robot is idle.
- Runtime contract handles stay on `window.__NOTELINGS_*` (read-only for tests). New: `__NOTELINGS_AGENT__`.
- Path preview (`ENABLE_PATH_PREVIEW`) is `false` by default — a dev aid only.
- Out of scope for M2 (deferred): Zustand store/dispatcher + 3-4 robot cast (M3), LLM API + Supabase + 2D UI overlay (M4), building any of the four expressions beyond rendering (M2 only walks `walking`↔`idle`; `processing`/`error` textures exist but are not triggered yet).
- Apply installed skills during execution: `r3f-fundamentals`, `r3f-best-practices` (no state setters in `useFrame` — the only React state write in `useFrame` is the arrival transition, which is a single terminal event, documented in Task 4), `ponytail` (smallest native solution), `vercel-react-best-practices`. Use `systematic-debugging` if pathing misbehaves.
- House commit pattern: feature commit, then `chore: sync activity log` (the post-commit hook appends the activity log; the second commit syncs it). No `git push` until the user approves at the end.
- Validation gates before "done": `npx tsc --noEmit`, `npm test` (vitest), `npm run lint` (0 errors; pre-existing skill warnings allowed), `npm run build`, `npm run test:e2e`.
- Windows repo: bash syntax, forward slashes, LF-only for `.sh`/`.mjs`/`.githooks` files.

## Current State and Decisions

- M1 is complete and locked (`c66f190`, pushed). The released app renders `OfficeCanvas → VoxelOffice → OfficeLockedScene` (60 locked items) with `frameloop="demand"`; the builder is dormant behind `ENABLE_OFFICE_BUILDER = false`.
- R3F v9 exposes `setFrameloop(frameloop)` on its store (`node_modules/@react-three/fiber/dist/declarations/src/core/store.d.ts:120`) — verified locally. `frameloop="demand"` is only the store's initial value from the Canvas prop; calling `setFrameloop` at runtime switches the loop without remounting the Canvas. This validates the approach of animating only while walking.
- `CapsuleGeometry` exists in three 0.185 (`@types/three/src/geometries/CapsuleGeometry.d.ts`), so no geometry helpers are needed.
- **User decisions:** (1) the robot + click-to-move are **live in the released app** (production path; camera stays fixed); (2) ship **one blue test robot** (pure M2 scope); (3) the A* path preview is **dev-flag-gated** (`ENABLE_PATH_PREVIEW`, default false).
- The locked 60-item scene is **not grid-aligned** (arbitrary float transforms, scaling, rotation). The grid contract (`BLOCKED_CELLS` from `PLACEMENTS`) is therefore merged at runtime with floor-level locked-scene items (`buildEffectiveBlockedCells`) so the robot visually avoids the released furniture. This merge is a best-effort heuristic; the grid contract remains authoritative for M3.
- Robot start cell is computed at module load with `findFreeCell` so it is never on a blocked cell; the e2e target cell is computed in the spec with the same helpers — deterministic given the locked data.
- zustand, Drei, and everything else needed are already installed; **no skill installation is required** (community skills are unvetted and A* here is a small pure module — the project's own skills suffice).

---

### Task 1: Grid inverse mapping + A* engine (pure, unit-tested)

**Files:**
- Modify: `components/office/officeLayout.ts` (append `worldToCell`)
- Create: `components/office/pathfinding.ts`
- Create: `components/office/pathfinding.test.ts`
- Modify: `components/office/officeLayout.test.ts` (append inverse roundtrip test)

**Interfaces:**
- Consumes: `CELL_SIZE`, `OFFICE_COLS`, `OFFICE_ROWS`, `BLOCKED_CELLS`, `cellToWorld` from `officeLayout.ts`.
- Produces:
  - `worldToCell(x: number, z: number): [number, number]` — inverse of `cellToWorld` (nearest cell, unclamped).
  - `type GridCell = [number, number]`
  - `type BlockedSet = ReadonlySet<string>` (keys `"col,row"`)
  - `findPath(start: GridCell, goal: GridCell, opts?: { blocked?: BlockedSet; cols?: number; rows?: number }): GridCell[] | null` — ordered path `[start, ..., goal]` inclusive; `null` when start/goal are out of bounds, blocked, or unreachable; `[start]` when already there.
  - `buildEffectiveBlockedCells(items: ReadonlyArray<{ kind: string; transform: { position: [number, number, number] } }>, base?: BlockedSet, opts?: { cols?: number; rows?: number }): Set<string>` — merges `base` with clamped grid cells for every `kind === 'wall'` item and every `kind === 'model'` item with `position[1] < 0.5`.
  - `findFreeCell(anchor: GridCell, blocked: BlockedSet, opts?: { cols?: number; rows?: number }): GridCell | null` — first non-blocked in-bounds cell scanning outward ring by ring from `anchor`.

- [ ] **Step 1: Write the failing tests**

`components/office/officeLayout.test.ts` — append:

```ts
it('round-trips world coords through cellToWorld/worldToCell', () => {
  const { worldToCell } = await import('./officeLayout') // or import at top
  const samples: Array<[number, number, number, number]> = [
    [0, 0, 9, 7],
    [0, 0, 0, 0],
    [OFFICE_COLS - 1, OFFICE_ROWS - 1, OFFICE_COLS - 1, OFFICE_ROWS - 1],
  ]
  for (const [col, row, expectedCol, expectedRow] of samples) {
    const [x, z] = cellToWorld(col, row)
    expect(worldToCell(x, z)).toEqual([expectedCol, expectedRow])
  }
})
```

(Adjust to a top-level `import { worldToCell }` — the test file already imports from `./officeLayout`; add `worldToCell` to that import instead of a dynamic import.)

`components/office/pathfinding.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { OFFICE_COLS, OFFICE_ROWS } from './officeLayout'
import { buildEffectiveBlockedCells, findFreeCell, findPath, type GridCell } from './pathfinding'

const none: ReadonlySet<string> = new Set()

describe('findPath', () => {
  it('returns a straight orthogonal path', () => {
    const path = findPath([2, 4], [2, 8], { blocked: none })
    expect(path?.map(([c, r]) => `${c},${r}`)).toEqual([
      '2,4', '2,5', '2,6', '2,7', '2,8',
    ])
  })

  it('routes around a blocked cell', () => {
    const path = findPath([4, 5], [6, 5], { blocked: new Set(['5,5']) })
    expect(path).not.toBeNull()
    expect(path![0]).toEqual([4, 5])
    expect(path![path!.length - 1]).toEqual([6, 5])
    expect(path!.every(([c, r]) => !(c === 5 && r === 5))).toBe(true)
    // Orthogonal steps only: each consecutive pair differs by exactly 1 in one axis
    for (let i = 1; i < path!.length; i += 1) {
      const [pc, pr] = path![i - 1]
      const [c, r] = path![i]
      expect(Math.abs(c - pc) + Math.abs(r - pr)).toBe(1)
    }
  })

  it('returns null when the goal is unreachable', () => {
    const path = findPath([2, 2], [2, 4], {
      blocked: new Set(['1,4', '3,4', '2,3', '2,5']),
    })
    expect(path).toBeNull()
  })

  it('returns the start cell when already at the goal', () => {
    expect(findPath([3, 3], [3, 3], { blocked: none })).toEqual([[3, 3]])
  })

  it('returns null for out-of-bounds, blocked start, and blocked goal', () => {
    expect(findPath([-1, 3], [3, 3], { blocked: none })).toBeNull()
    expect(findPath([3, 3], [OFFICE_COLS, 3], { blocked: none })).toBeNull()
    expect(findPath([3, 3], [4, 4], { blocked: new Set(['3,3']) })).toBeNull()
    expect(findPath([3, 3], [4, 4], { blocked: new Set(['4,4']) })).toBeNull()
  })
})

describe('buildEffectiveBlockedCells', () => {
  it('keeps the base set and adds walls plus floor-level models', () => {
    const items = [
      { kind: 'wall', transform: { position: [-12, 1.7, -7] as [number, number, number] } },
      { kind: 'model', transform: { position: [0.9, 0, -5.9] as [number, number, number] } },
      { kind: 'model', transform: { position: [0.9, 1.1, 2.5] as [number, number, number] } }, // elevated → skipped
      { kind: 'floor', transform: { position: [-2.3, 0, -1.4] as [number, number, number] } }, // skipped
    ]
    const blocked = buildEffectiveBlockedCells(items, new Set(['0,0']))
    expect(blocked.has('0,0')).toBe(true) // base preserved
    expect(blocked.has('0,0')).toBe(true) // wall clamped to border cell
    expect(blocked.has('10,2')).toBe(true) // model at (0.9, -5.9)
    expect(blocked.has('9,9')).toBe(false) // elevated model skipped
    expect(blocked.has('8,7')).toBe(false) // floor item skipped
  })

  it('clamps out-of-grid furniture to the border', () => {
    const blocked = buildEffectiveBlockedCells([
      { kind: 'model', transform: { position: [-40, 0, 40] as [number, number, number] } },
    ])
    expect(blocked.has('0,13')).toBe(true) // clamped to row OFFICE_ROWS - 1
  })
})

describe('findFreeCell', () => {
  it('finds the nearest free in-bounds cell and returns null when fully blocked', () => {
    expect(findFreeCell([3, 3], new Set(['3,3', '4,3', '2,3', '3,2', '3,4']))).toEqual([4, 4])
    const all = new Set<string>()
    for (let c = 0; c < OFFICE_COLS; c += 1)
      for (let r = 0; r < OFFICE_ROWS; r += 1) all.add(`${c},${r}`)
    expect(findFreeCell([9, 7], all)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/office/officeLayout.test.ts components/office/pathfinding.test.ts`
Expected: FAIL — `worldToCell` and `./pathfinding` do not exist.

- [ ] **Step 3: Implement `worldToCell`** — append to `components/office/officeLayout.ts`:

```ts
/** Convert world [x, z] to the nearest grid cell [col, row] (inverse of cellToWorld). */
export function worldToCell(x: number, z: number): [number, number] {
  const col = Math.round(x / CELL_SIZE + OFFICE_COLS / 2)
  const row = Math.round(z / CELL_SIZE + OFFICE_ROWS / 2)
  return [col, row]
}
```

- [ ] **Step 4: Implement `components/office/pathfinding.ts`**

```ts
import { BLOCKED_CELLS, OFFICE_COLS, OFFICE_ROWS, worldToCell } from './officeLayout'

export type GridCell = [number, number]
export type BlockedSet = ReadonlySet<string>

const cellKey = (cell: GridCell): string => `${cell[0]},${cell[1]}`
const inBounds = (cell: GridCell, cols: number, rows: number): boolean =>
  cell[0] >= 0 && cell[0] < cols && cell[1] >= 0 && cell[1] < rows

const NEIGHBORS: ReadonlyArray<GridCell> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function manhattan(a: GridCell, b: GridCell): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

/**
 * A* over the 18×14 office grid. Orthogonal (4-directional) movement with a
 * Manhattan heuristic. Returns the ordered path [start, ..., goal] inclusive,
 * or null when unreachable or invalid. The grid is < 300 cells, so a simple
 * open-list minimum scan is smaller and clearer than a binary heap (ponytail).
 */
export function findPath(
  start: GridCell,
  goal: GridCell,
  opts: { blocked?: BlockedSet; cols?: number; rows?: number } = {},
): GridCell[] | null {
  const blocked = opts.blocked ?? BLOCKED_CELLS
  const cols = opts.cols ?? OFFICE_COLS
  const rows = opts.rows ?? OFFICE_ROWS

  if (!inBounds(start, cols, rows) || !inBounds(goal, cols, rows)) return null
  if (blocked.has(cellKey(start)) || blocked.has(cellKey(goal))) return null
  if (start[0] === goal[0] && start[1] === goal[1]) return [start]

  const open: GridCell[] = [start]
  const closed = new Set<string>()
  const cameFrom = new Map<string, GridCell>()
  const gScore = new Map<string, number>([[cellKey(start), 0]])
  const fScore = new Map<string, number>([[cellKey(start), manhattan(start, goal)]])

  const bestOpen = (): GridCell => {
    let best = open[0]
    let bestF = fScore.get(cellKey(best)) ?? Infinity
    for (const cell of open) {
      const f = fScore.get(cellKey(cell)) ?? Infinity
      if (f < bestF) {
        best = cell
        bestF = f
      }
    }
    return best
  }

  while (open.length > 0) {
    const current = bestOpen()
    if (current[0] === goal[0] && current[1] === goal[1]) {
      const path: GridCell[] = []
      let cursor: GridCell | undefined = goal
      while (cursor) {
        path.push(cursor)
        cursor = cameFrom.get(cellKey(cursor))
      }
      return path.reverse()
    }

    open.splice(open.indexOf(current), 1)
    closed.add(cellKey(current))

    for (const [dx, dz] of NEIGHBORS) {
      const neighbor: GridCell = [current[0] + dx, current[1] + dz]
      const nKey = cellKey(neighbor)
      if (!inBounds(neighbor, cols, rows) || blocked.has(nKey) || closed.has(nKey)) continue
      const tentative = (gScore.get(cellKey(current)) ?? Infinity) + 1
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current)
        gScore.set(nKey, tentative)
        fScore.set(nKey, tentative + manhattan(neighbor, goal))
        if (!open.some(([c, r]) => c === neighbor[0] && r === neighbor[1])) open.push(neighbor)
      }
    }
  }
  return null
}

/**
 * Merge the grid-contract BLOCKED_CELLS with floor-level locked-scene items so
 * the released (non-grid-aligned) furniture also blocks robot paths. Walls are
 * always blocked; models sitting below y=0.5 are floor-level; elevated decor
 * (clocks, boards, desktop items) is not. Out-of-grid positions clamp to the
 * border so the resulting set stays within the 18×14 grid.
 */
export function buildEffectiveBlockedCells(
  items: ReadonlyArray<{ kind: string; transform: { position: [number, number, number] } }>,
  base: BlockedSet = BLOCKED_CELLS,
  opts: { cols?: number; rows?: number } = {},
): Set<string> {
  const cols = opts.cols ?? OFFICE_COLS
  const rows = opts.rows ?? OFFICE_ROWS
  const blocked = new Set(base)
  for (const item of items) {
    const isWall = item.kind === 'wall'
    const onFloor = item.kind === 'model' && item.transform.position[1] < 0.5
    if (!isWall && !onFloor) continue
    const [col, row] = worldToCell(item.transform.position[0], item.transform.position[2])
    blocked.add(`${Math.min(cols - 1, Math.max(0, col))},${Math.min(rows - 1, Math.max(0, row))}`)
  }
  return blocked
}

/**
 * First free in-bounds cell scanning outward from `anchor` ring by ring
 * (Chebyshev radius). Used to pick the robot start and e2e targets.
 */
export function findFreeCell(
  anchor: GridCell,
  blocked: BlockedSet,
  opts: { cols?: number; rows?: number } = {},
): GridCell | null {
  const cols = opts.cols ?? OFFICE_COLS
  const rows = opts.rows ?? OFFICE_ROWS
  for (let radius = 0; radius <= Math.max(cols, rows); radius += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
        const cell: GridCell = [anchor[0] + dc, anchor[1] + dr]
        if (!inBounds(cell, cols, rows)) continue
        if (blocked.has(cellKey(cell))) continue
        return cell
      }
    }
  }
  return null
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/office/officeLayout.test.ts components/office/pathfinding.test.ts`
Expected: all PASS (officeLayout suite keeps its 7 existing tests plus the new roundtrip).

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` — no errors.

```bash
git add components/office/officeLayout.ts components/office/officeLayout.test.ts components/office/pathfinding.ts components/office/pathfinding.test.ts
git commit -m "feat: add worldToCell inverse + A* pathfinding engine with tests"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the deterministic, unit-tested pathfinding layer Milestones 2–3 consume.

---

### Task 2: Agent state type + LCD expression config (pure, unit-tested)

**Files:**
- Create: `components/office/agentState.ts`
- Create: `components/office/agentState.test.ts`

**Interfaces:**
- Consumes: nothing (standalone).
- Produces:
  - `type AgentState = 'idle' | 'processing' | 'walking' | 'error'` — the exact four states MASTER_SPEC §3 defines (M3's Zustand store will reuse this type).
  - `const AGENT_STATES: readonly AgentState[]`
  - `const FACE_STYLES: Record<AgentState, { glyph: string; screen: string; ink: string; glow: string }>` — pure config consumed by `agentFace.ts` (Task 3).

- [ ] **Step 1: Write the failing test** `components/office/agentState.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { AGENT_STATES, FACE_STYLES } from './agentState'

describe('agentState', () => {
  it('defines exactly the four spec states in order', () => {
    expect(AGENT_STATES).toEqual(['idle', 'processing', 'walking', 'error'])
  })

  it('maps each state to the exact spec expression glyphs', () => {
    expect(FACE_STYLES.idle.glyph).toBe('^ ^')
    expect(FACE_STYLES.processing.glyph).toBe('- -')
    expect(FACE_STYLES.walking.glyph).toBe('O O')
    expect(FACE_STYLES.error.glyph).toBe('X X')
  })

  it('gives every state a full style tuple', () => {
    for (const state of AGENT_STATES) {
      const style = FACE_STYLES[state]
      expect(style.screen.length).toBeGreaterThan(0)
      expect(style.ink.length).toBeGreaterThan(0)
      expect(style.glow.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/office/agentState.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `components/office/agentState.ts`**

```ts
/** Librarian agent states — the four MASTER_SPEC §3 expressions. */
export type AgentState = 'idle' | 'processing' | 'walking' | 'error'

export const AGENT_STATES: readonly AgentState[] = ['idle', 'processing', 'walking', 'error']

/**
 * LCD face style per state (pure config; the canvas drawing lives in
 * agentFace.ts so this stays unit-testable in Node).
 */
export const FACE_STYLES: Record<AgentState, { glyph: string; screen: string; ink: string; glow: string }> = {
  idle: { glyph: '^ ^', screen: '#0b1622', ink: '#7de3ff', glow: '#38bdf8' },
  processing: { glyph: '- -', screen: '#14100b', ink: '#ffd166', glow: '#f59e0b' },
  walking: { glyph: 'O O', screen: '#0b1622', ink: '#7de3ff', glow: '#38bdf8' },
  error: { glyph: 'X X', screen: '#1a0b0b', ink: '#ff6b6b', glow: '#ef4444' },
}
```

- [ ] **Step 4: Run test to verify it passes** — expected PASS.
- [ ] **Step 5: Commit**

```bash
git add components/office/agentState.ts components/office/agentState.test.ts
git commit -m "feat: define agent states and LCD expression config"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the typed agent contract (state machine + face style config) that Task 3–4 draw from and M3 consumes.

---

### Task 3: LCD face CanvasTexture helper (browser-only)

**Files:**
- Create: `components/office/agentFace.ts`

**Interfaces:**
- Consumes: `AgentState`, `FACE_STYLES` from `agentState.ts`.
- Produces: `createFaceTexture(state: AgentState, size?: number): THREE.CanvasTexture` — draws a dark bezel, a tinted screen, and the two glyph characters split from `glyph` (e.g. `'^ ^'` → `'^'` + `'^'`), with a soft glow, at the two horizontal thirds of the canvas. Sets `colorSpace = THREE.SRGBColorSpace` and `needsUpdate = true`.

- [ ] **Step 1: Implement `components/office/agentFace.ts`**

```ts
'use client'
import * as THREE from 'three'
import type { AgentState } from './agentState'
import { FACE_STYLES } from './agentState'

export const FACE_TEXTURE_SIZE = 256

/** Draw one state's LCD face onto a 2D canvas and return a CanvasTexture. */
export function createFaceTexture(state: AgentState, size = FACE_TEXTURE_SIZE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const style = FACE_STYLES[state]
  const pad = size * 0.06
  ctx.fillStyle = '#06090d' // bezel
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = style.screen // screen
  ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2)

  const [left, right] = style.glyph.split(' ')
  ctx.font = `bold ${Math.floor(size * 0.34)}px Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style.ink
  ctx.shadowColor = style.glow
  ctx.shadowBlur = size * 0.06
  ctx.fillText(left, size / 3, size / 2)
  ctx.fillText(right, (size * 2) / 3, size / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Canvas texture correctness is verified by Task 6's e2e: the face material must have `userData.notelingsHasMap`-style map presence — see Task 6 — and browser QA.)

- [ ] **Step 3: Commit**

```bash
git add components/office/agentFace.ts
git commit -m "feat: add LCD face CanvasTexture helper for agent expressions"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** a memoizable texture factory the robot re-creates only when its state changes.

---

### Task 4: `<AgentRobot />` primitive with movement + frameloop control

**Files:**
- Create: `components/office/AgentRobot.tsx`

**Interfaces:**
- Consumes: `worldToCell`, `cellToWorld`, `CELL_SIZE` (`officeLayout.ts`); `findPath`, `GridCell`, `BlockedSet` (`pathfinding.ts`); `AgentState` (`agentState.ts`); `createFaceTexture` (`agentFace.ts`).
- Produces:
  - `type AgentRobotHandle = { moveTo(cell: GridCell): boolean }` — imperative handle (forwardRef). Returns `false` when there is no path, the goal is blocked, or the robot is already there.
  - `<AgentRobot ref start blocked name? onStateChange? onPathChange? />`:
    - `start: GridCell`, `blocked: BlockedSet`, `name?: string` (default `'agent-robot'`), `onStateChange?: (state: AgentState) => void`, `onPathChange?: (path: GridCell[] | null) => void`.
    - Scene contract: group `name="agent-robot"` with `userData.notelingsAgentRole = 'agent'`, `userData.notelingsAgentState = state` (React-driven, updates on re-render), `userData.notelingsAgentStart = start`. Body mesh `castShadow receiveShadow`. Face mesh (LCD) `ref` mounted at `[0, 0.06, BODY_RADIUS + 0.012]`.
  - Behavior: `moveTo` computes the path from the robot's current cell (via `worldToCell` of its world position) to the goal, drops the first path cell (already standing on it), sets `walking`, calls `onPathChange(path)`, and `setFrameloop('always')`. `useFrame` advances toward each waypoint center at `CELLS_PER_SECOND * CELL_SIZE` world units/sec (delta clamped to 0.05s), pops waypoints within `WAYPOINT_EPSILON`, faces the travel heading via `group.rotation.y = Math.atan2(dx, dz)`, and keeps the LCD facing the fixed camera via `face.lookAt(camera.position)` every frame. On the last waypoint: sets `idle`, `onPathChange(null)`, `setFrameloop('demand')`, `invalidate()`.
  - Constants: `BODY_RADIUS = 0.38`, `BODY_LENGTH = 0.72`, `BODY_COLOR = '#2fa8e0'`, `FACE_WIDTH = 0.5`, `FACE_HEIGHT = 0.32`, `CELLS_PER_SECOND = 2.2`, `WAYPOINT_EPSILON = 0.02`.
  - Cleanup: on unmount, restore `setFrameloop('demand')` (dev HMR/StrictMode safety).

- [ ] **Step 1: Implement `components/office/AgentRobot.tsx`**

```tsx
'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CELL_SIZE, cellToWorld, worldToCell } from './officeLayout'
import { findPath, type BlockedSet, type GridCell } from './pathfinding'
import type { AgentState } from './agentState'
import { createFaceTexture } from './agentFace'

export type AgentRobotHandle = { moveTo: (cell: GridCell) => boolean }

const BODY_RADIUS = 0.38
const BODY_LENGTH = 0.72
const BODY_COLOR = '#2fa8e0'
const FACE_WIDTH = 0.5
const FACE_HEIGHT = 0.32
const CELLS_PER_SECOND = 2.2
const WAYPOINT_EPSILON = 0.02

type AgentRobotProps = {
  start: GridCell
  blocked: BlockedSet
  name?: string
  onStateChange?: (state: AgentState) => void
  onPathChange?: (path: GridCell[] | null) => void
}

const AgentRobot = forwardRef<AgentRobotHandle, AgentRobotProps>(function AgentRobot(
  { start, blocked, name = 'agent-robot', onStateChange, onPathChange },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null)
  const faceMeshRef = useRef<THREE.Mesh>(null)
  const pathRef = useRef<GridCell[]>([])
  const [state, setState] = useState<AgentState>('idle')
  const [startWorld] = useState<[number, number]>(() => cellToWorld(start[0], start[1]))

  const camera = useThree((state) => state.camera)
  const setFrameloop = useThree((state) => state.setFrameloop)
  const invalidate = useThree((state) => state.invalidate)

  // Recreate the LCD texture only when the expression changes.
  const faceTexture = useMemo(() => createFaceTexture(state), [state])

  // Restore demand rendering if the robot unmounts mid-walk (HMR/StrictMode).
  useEffect(() => () => setFrameloop('demand'), [setFrameloop])

  // Orient the LCD once on mount (fixed camera) so the first idle frame is right.
  useEffect(() => {
    faceMeshRef.current?.lookAt(camera.position)
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      moveTo(goal: GridCell): boolean {
        const group = groupRef.current
        if (!group) return false
        const current = worldToCell(group.position.x, group.position.z)
        const path = findPath(current, goal, { blocked })
        if (!path || path.length <= 1) return false
        pathRef.current = path.slice(1) // robot already stands on the start cell
        setState('walking')
        onStateChange?.('walking')
        onPathChange?.(path)
        setFrameloop('always')
        return true
      },
    }),
    [blocked, onPathChange, onStateChange, setFrameloop],
  )

  // The only React state write in useFrame is the terminal arrival transition.
  useFrame((_, delta) => {
    const group = groupRef.current
    const face = faceMeshRef.current
    if (!group || !face) return
    face.lookAt(camera.position)
    if (pathRef.current.length === 0) return

    const [tx, tz] = cellToWorld(pathRef.current[0][0], pathRef.current[0][1])
    const dx = tx - group.position.x
    const dz = tz - group.position.z
    const distance = Math.hypot(dx, dz)
    const step = CELLS_PER_SECOND * CELL_SIZE * Math.min(delta, 0.05)

    if (distance <= Math.max(step, WAYPOINT_EPSILON)) {
      group.position.x = tx
      group.position.z = tz
      pathRef.current.shift()
      if (pathRef.current.length === 0) {
        setState('idle')
        onStateChange?.('idle')
        onPathChange?.(null)
        setFrameloop('demand')
        invalidate()
      }
    } else {
      group.position.x += (dx / distance) * step
      group.position.z += (dz / distance) * step
      group.rotation.y = Math.atan2(dx, dz)
    }
  })

  return (
    <group
      ref={groupRef}
      name={name}
      position={[startWorld[0], 0, startWorld[1]]}
      userData={{
        notelingsAgentRole: 'agent',
        notelingsAgentState: state,
        notelingsAgentStart: start,
      }}
    >
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 12, 24]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh ref={faceMeshRef} position={[0, 0.06, BODY_RADIUS + 0.012]}>
        <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
        <meshBasicMaterial map={faceTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  )
})

export default AgentRobot
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/office/AgentRobot.tsx
git commit -m "feat: add AgentRobot capsule primitive with A* movement and frameloop control"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the interactive robot. (It is not mounted yet — Task 5 wires it in.)

---

### Task 5: `<AgentLayer />` — nav floor, click-to-move, path preview flag, runtime handle

**Files:**
- Create: `components/office/AgentLayer.tsx`
- Modify: `components/office/officeMode.ts` (append `ENABLE_PATH_PREVIEW = false`)
- Modify: `components/office/officeMode.test.ts` (assert the new flag)
- Modify: `components/office/VoxelOffice.tsx` (mount `<AgentLayer />` in the static branch)

**Interfaces:**
- Consumes: `FLOOR_WIDTH`/`FLOOR_DEPTH` (`Floor.tsx`), `worldToCell`/`cellToWorld` (`officeLayout.ts`), `findPath`/`buildEffectiveBlockedCells`/`findFreeCell`/`GridCell` (`pathfinding.ts`), `<AgentRobot />` + `AgentRobotHandle`, `LOCKED_DEFAULT_ITEMS` (`officeBuilderDefault.ts`), `ENABLE_PATH_PREVIEW` (`officeMode.ts`).
- Produces:
  - `const AGENT_START_CELL: GridCell` — module-level: `findFreeCell([3, 6], buildEffectiveBlockedCells(LOCKED_DEFAULT_ITEMS)) ?? [9, 7]`.
  - `<AgentLayer />`:
    - group `name="agent-layer"` with `userData.notelingsAgentLayer = true`.
    - Invisible nav floor: `<mesh name="nav-floor">` — `planeGeometry [FLOOR_WIDTH, FLOOR_DEPTH]`, `rotation-x={-Math.PI / 2}`, `position-y={0.012}`, `meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide}`, `onClick={handleFloorClick}`.
    - `<AgentRobot ref={robotRef} start={AGENT_START_CELL} blocked={effectiveBlocked} onStateChange={onStateChange} onPathChange={onPathChange} />`.
    - Dev path preview: when `ENABLE_PATH_PREVIEW` and a path exists, a Drei `<Line points={cellCenters} color="#38bdf8" lineWidth={2} transparent opacity={0.7} />` at `y = 0.03`.
    - Runtime handle: `window.__NOTELINGS_AGENT__ = { state, currentCell, pathLength }` (mutated via the callbacks — no extra renders).
  - `handleFloorClick(event: ThreeEvent<MouseEvent>)`: `worldToCell(event.point.x, event.point.z)` → `robotRef.current?.moveTo(cell)`. Blocked goals already return `false` from `findPath`, so furniture clicks are ignored.
  - `effectiveBlocked`: `useMemo(() => buildEffectiveBlockedCells(LOCKED_DEFAULT_ITEMS), [])`.

- [ ] **Step 1: Append the flag to `components/office/officeMode.ts`**

```ts
/**
 * Show the computed A* path while a robot walks. Development aid only;
 * keep false in the released app.
 */
export const ENABLE_PATH_PREVIEW = false
```

- [ ] **Step 2: Extend `components/office/officeMode.test.ts`**

```ts
import { ENABLE_OFFICE_BUILDER, ENABLE_PATH_PREVIEW } from './officeMode'

it('keeps the path preview disabled for the released app', () => {
  expect(ENABLE_PATH_PREVIEW).toBe(false)
})
```

- [ ] **Step 3: Implement `components/office/AgentLayer.tsx`**

```tsx
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { FLOOR_DEPTH, FLOOR_WIDTH } from './Floor'
import { cellToWorld, worldToCell } from './officeLayout'
import { buildEffectiveBlockedCells, findFreeCell, type GridCell } from './pathfinding'
import AgentRobot, { type AgentRobotHandle } from './AgentRobot'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { ENABLE_PATH_PREVIEW } from './officeMode'
import type { AgentState } from './agentState'

/** First free cell near the lounge front — computed so the start is never blocked. */
export const AGENT_START_CELL: GridCell =
  findFreeCell([3, 6], buildEffectiveBlockedCells(LOCKED_DEFAULT_ITEMS)) ?? [9, 7]

export default function AgentLayer() {
  const robotRef = useRef<AgentRobotHandle>(null)
  const [previewPath, setPreviewPath] = useState<GridCell[] | null>(null)
  const effectiveBlocked = useMemo(
    () => buildEffectiveBlockedCells(LOCKED_DEFAULT_ITEMS),
    [],
  )

  // Mutable runtime contract for e2e/browser QA — no extra renders.
  const runtimeRef = useRef({ state: 'idle' as AgentState, currentCell: AGENT_START_CELL, pathLength: 0 })
  useEffect(() => {
    ;(window as unknown as { __NOTELINGS_AGENT__: typeof runtimeRef.current }).__NOTELINGS_AGENT__ =
      runtimeRef.current
  }, [])

  const onStateChange = (state: AgentState) => {
    runtimeRef.current.state = state
  }
  const onPathChange = (path: GridCell[] | null) => {
    runtimeRef.current.pathLength = path ? path.length : 0
    runtimeRef.current.currentCell = path ? path[0] : AGENT_START_CELL
    setPreviewPath(path) // React state only updates on real path assignment
  }

  const handleFloorClick = (event: ThreeEvent<MouseEvent>) => {
    const [col, row] = worldToCell(event.point.x, event.point.z)
    robotRef.current?.moveTo([col, row])
  }

  const previewPoints: Array<[number, number, number]> = (previewPath ?? []).map(([col, row]) => {
    const [x, z] = cellToWorld(col, row)
    return [x, 0.03, z]
  })

  return (
    <group name="agent-layer" userData={{ notelingsAgentLayer: true }}>
      <mesh
        name="nav-floor"
        rotation-x={-Math.PI / 2}
        position-y={0.012}
        onClick={handleFloorClick}
      >
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <AgentRobot
        ref={robotRef}
        start={AGENT_START_CELL}
        blocked={effectiveBlocked}
        onStateChange={onStateChange}
        onPathChange={onPathChange}
      />
      {ENABLE_PATH_PREVIEW && previewPoints.length > 1 && (
        <Line points={previewPoints} color="#38bdf8" lineWidth={2} transparent opacity={0.7} />
      )}
    </group>
  )
}
```

- [ ] **Step 4: Mount the layer in `components/office/VoxelOffice.tsx`**

Replace the static branch so the robot rides along without touching `OfficeLockedScene`:

```tsx
import AgentLayer from './AgentLayer'

export default function VoxelOffice() {
  if (!ENABLE_OFFICE_BUILDER) {
    return (
      <>
        <OfficeLockedScene />
        <AgentLayer />
      </>
    )
  }
  return (
    <Suspense fallback={null}>
      <OfficeBuilderScene />
    </Suspense>
  )
}
```

- [ ] **Step 5: Typecheck + unit tests**

Run: `npx tsc --noEmit` and `npx vitest run components/office/officeMode.test.ts`
Expected: both pass.

- [ ] **Step 6: Dev-server manual smoke**

Run: `npm run dev`, open `http://localhost:3000`. Expected: the office renders with the blue robot standing in the lounge area; clicking an empty floor cell makes it walk there and stop; the camera never moves; no console errors. (Full click automation is Task 6.)

- [ ] **Step 7: Commit**

```bash
git add components/office/AgentLayer.tsx components/office/officeMode.ts components/office/officeMode.test.ts components/office/VoxelOffice.tsx
git commit -m "feat: add click-to-move agent layer with invisible nav floor and path preview flag"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** the live Milestone 2 experience — click the floor, the robot walks the A* path.

---

### Task 6: Extend the Playwright contract (robot presence + click-to-move e2e)

**Files:**
- Modify: `e2e/office-smoke.spec.ts` (add a second test; keep the existing static-diorama test unchanged)

**Interfaces:**
- Consumes: `findPath`, `buildEffectiveBlockedCells`, `GridCell` (`pathfinding.ts`), `cellToWorld` (`officeLayout.ts`), `LOCKED_DEFAULT_ITEMS` (`officeBuilderDefault.ts`), `AGENT_START_CELL` (`AgentLayer.tsx`), `window.__NOTELINGS_SCENE__`/`__NOTELINGS_CAMERA__`/`__NOTELINGS_AGENT__`.
- Produces: e2e proof that the robot renders at its start cell, a real mouse click on a free floor cell moves it there, state transitions `idle → walking → idle`, and the static-diorama contracts still hold.

- [ ] **Step 1: Add imports and a projection helper to the spec**

```ts
import { findPath, buildEffectiveBlockedCells, type GridCell } from '../components/office/pathfinding'
import { cellToWorld } from '../components/office/officeLayout'
import { AGENT_START_CELL } from '../components/office/AgentLayer'

/** Orthographic world → viewport pixels using the live camera matrix + zoom. */
async function worldToScreen(
  page: import('@playwright/test').Page,
  x: number,
  y: number,
  z: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate(([wx, wy, wz]) => {
    const cam = (
      window as unknown as {
        __NOTELINGS_CAMERA__?: { matrixWorldInverse?: { elements: number[] }; zoom?: number }
      }
    ).__NOTELINGS_CAMERA__
    const canvas = document.querySelector('canvas')
    if (!cam?.matrixWorldInverse || !canvas) throw new Error('camera/canvas missing')
    const rect = canvas.getBoundingClientRect()
    const m = cam.matrixWorldInverse.elements
    const vx = m[0] * wx + m[4] * wy + m[8] * wz + m[12]
    const vy = m[1] * wx + m[5] * wy + m[9] * wz + m[13]
    const zoom = cam.zoom ?? 1
    const ndcX = vx / (rect.width / (2 * zoom))
    const ndcY = vy / (rect.height / (2 * zoom))
    return {
      x: rect.left + (ndcX * 0.5 + 0.5) * rect.width,
      y: rect.top + (1 - (ndcY * 0.5 + 0.5)) * rect.height,
    }
  }, [x, y, z])
}

/** A reachable free cell a few cells away from the robot start (deterministic). */
function pickTargetCell(): GridCell {
  const blocked = buildEffectiveBlockedCells(LOCKED_DEFAULT_ITEMS)
  for (const d of [4, 3, 5, 2, 6]) {
    for (const candidate of [
      [AGENT_START_CELL[0] + d, AGENT_START_CELL[1]],
      [AGENT_START_CELL[0] - d, AGENT_START_CELL[1]],
      [AGENT_START_CELL[0], AGENT_START_CELL[1] + d],
      [AGENT_START_CELL[0], AGENT_START_CELL[1] - d],
    ] as GridCell[]) {
      if (!blocked.has(`${candidate[0]},${candidate[1]}`) && findPath(AGENT_START_CELL, candidate, { blocked })) {
        return candidate
      }
    }
  }
  throw new Error('no reachable free target near agent start')
}
```

- [ ] **Step 2: Add the agent test**

```ts
test('agent robot renders at start and click-to-move walks an A* path', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })

  const target = pickTargetCell()
  const [tx, tz] = cellToWorld(target[0], target[1])
  const TOLERANCE = 0.15

  // Robot exists at its start cell with the idle state.
  await page.waitForFunction(
    (startKey) => {
      type Obj = { name?: string; children?: Obj[]; isMesh?: boolean }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      if (!scene) return false
      const find = (root: Obj, name: string): Obj | undefined => {
        if (root.name === name) return root
        for (const child of root.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const meshCount = (root: Obj): number =>
        (root.isMesh ? 1 : 0) + (root.children ?? []).reduce((n, c) => n + meshCount(c), 0)
      const robot = find(scene, 'agent-robot')
      const agent = (window as unknown as { __NOTELINGS_AGENT__?: { state?: string } }).__NOTELINGS_AGENT__
      return Boolean(robot && meshCount(robot) >= 2 && agent?.state === 'idle' && startKey)
    },
    `${AGENT_START_CELL[0]},${AGENT_START_CELL[1]}`,
    { timeout: 30_000, polling: 500 },
  )

  // Click the target cell's projected screen position (up to 3 jitter retries
  // in case the ray is occluded by a no-handler object that swallows the hit).
  const { x, y } = await worldToScreen(page, tx, 0, tz)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.click(x + attempt * 10, y + attempt * 10)
    await page.waitForTimeout(400)
    const state = await page.evaluate(
      () => (window as unknown as { __NOTELINGS_AGENT__?: { state?: string } }).__NOTELINGS_AGENT__?.state,
    )
    if (state === 'walking') break
  }

  // Robot arrives at the target cell center and returns to idle.
  await page.waitForFunction(
    ({ tx, tz, tolerance }) => {
      type Obj = { name?: string; children?: Obj[]; position?: { x: number; z: number } }
      const scene = (window as unknown as { __NOTELINGS_SCENE__?: Obj }).__NOTELINGS_SCENE__
      if (!scene) return false
      const find = (root: Obj, name: string): Obj | undefined => {
        if (root.name === name) return root
        for (const child of root.children ?? []) {
          const match = find(child, name)
          if (match) return match
        }
        return undefined
      }
      const robot = find(scene, 'agent-robot')
      const agent = (window as unknown as { __NOTELINGS_AGENT__?: { state?: string } }).__NOTELINGS_AGENT__
      if (!robot?.position || agent?.state !== 'idle') return false
      return Math.abs(robot.position.x - tx) < tolerance && Math.abs(robot.position.z - tz) < tolerance
    },
    { tx, tz, tolerance: TOLERANCE },
    { timeout: 30_000, polling: 300 },
  )

  expect(errors).toEqual([])
  await page.screenshot({ path: 'test-results/office-agent-walk.png', fullPage: true })
})
```

- [ ] **Step 3: Run the suite**

Run: `npm run test:e2e`
Expected: both tests PASS (static diorama + agent click-to-move); `test-results/office-agent-walk.png` written.

- [ ] **Step 4: Commit**

```bash
git add e2e/office-smoke.spec.ts
git commit -m "test: cover agent robot rendering and click-to-move A* walking"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** automated proof of the full M2 loop with zero console errors.

---

### Task 7: Documentation and memory sync

**Files:**
- Modify: `post-processing.md` (add a "frameloop while agents move" note to the demand-rendering bullet)
- Modify: `handoff.md` (M2 work completed + next steps)
- Modify: `knowledge.md` (architecture facts: AgentRobot/AgentLayer/pathfinding/worldToCell/setFrameloop discipline; `ENABLE_PATH_PREVIEW`)
- Modify: `docs/lessons-learned.md` **only if** execution surfaced a real lesson (e.g. R3F raycast pass-through behavior, `lookAt` parenting, or the non-grid-aligned locked scene merge) — capture immediately, per session protocol

- [ ] **Step 1: Update `post-processing.md`** — in the "Related rendering settings → Canvas and renderer" section, extend the demand-rendering bullet:

```markdown
- Demand rendering: the R3F loop sleeps while the scene is idle and renders again when R3F invalidates the canvas... When an agent robot walks, it switches the store frameloop to `"always"` via `useThree(s => s.setFrameloop)` for the duration of the walk and switches back to `"demand"` (with an explicit `invalidate()`) on arrival. Idle frames therefore remain demand-driven.
```

- [ ] **Step 2: Update `handoff.md`** — append a date-stamped "Work completed — Milestone 2 (agent robots)" section: what shipped (worldToCell, A* + effective blocked merge, agentState/FACE_STYLES, agentFace texture, AgentRobot with setFrameloop discipline, AgentLayer click-to-move + nav floor + runtime handle, ENABLE_PATH_PREVIEW=false), the user decisions (live in released app, one blue robot, dev-gated path preview), validation results, and next steps (M3: Zustand TaskQueue + 3-4 robot cast; M4: LLM/UI/Supabase).
- [ ] **Step 3: Update `knowledge.md`** — add architecture bullets: grid math (`worldToCell` inverse, `pathfinding.ts` findPath/buildEffectiveBlockedCells/findFreeCell), agent stack (`agentState.ts` four-state contract reused by M3's Zustand store, `AgentRobot` imperative `moveTo` handle, `AgentLayer` nav floor + `__NOTELINGS_AGENT__`), frameloop discipline ("always only while walking; demand + invalidate on arrival"), `ENABLE_PATH_PREVIEW`, and the note that the locked scene is not grid-aligned so path blocking merges locked floor items (heuristic).
- [ ] **Step 4: Expand `docs/lessons-learned.md`** for anything discovered during execution (mandatory, immediate).
- [ ] **Step 5: Commit**

```bash
git add post-processing.md handoff.md knowledge.md docs/lessons-learned.md
git commit -m "docs: record Milestone 2 agent robots in memory system"
git add docs/activity-log.md && git commit -m "chore: sync activity log"
```

**Produces:** an accurate, lean memory trail for the next session and for M3.

---

### Task 8: Final validation

**Files:**
- No new source files; validate everything.

- [ ] **Step 1: Full validation gates**

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
npm run test:e2e
```

Expected: typecheck clean; all vitest suites pass (existing 17 + new pathfinding/agentState/officeMode-roundtrip tests); lint 0 errors (pre-existing skill-script warnings remain); production build succeeds; both Playwright tests pass.

- [ ] **Step 2: Browser QA (repeat-load regression)**

Run `npm run dev` and load `http://localhost:3000` twice (fresh + reload). Confirm each time: office renders fully, robot is at its start cell with an `^ ^` face, a click walks it, idle frameloop returns (no continuous repaint), and zero console/page errors.

- [ ] **Step 3: Review**

Have the changes reviewed (code-reviewer pass over AgentRobot/AgentLayer/pathfinding) before declaring M2 done. Fix any findings, re-run Step 1 gates.

- [ ] **Step 4: Report and (only with user approval) push**

Summarize the diff, run `git status --short`, and wait for the user to approve pushing to `origin/main`.

**Produces:** a fully validated, documented Milestone 2.

---

## Self-review

- **Spec coverage (MASTER_SPEC_FINAL.md §3, §9-M2):** capsule robot primitives — Task 4; LCD face with `^ ^`/`- -`/`O O`/`X X` expressions mapped from state — Tasks 2–4 (all four exist; M2 triggers `walking`/`idle`); 2D grid array mapping obstacles — Task 1 (`BLOCKED_CELLS` + effective merge); A* — Task 1; click-to-move — Task 5; smooth lerp — Task 4; face changes while moving — Task 4. The spec's GPU-saving frameloop idea is implemented with R3F's store `setFrameloop`, validated against the local v9 types.
- **Placeholder scan:** every task has concrete code, exact file paths, runnable commands, and expected outcomes; no "TBD/appropriate handling" placeholders.
- **Type consistency:** `GridCell`, `BlockedSet`, `AgentState`, `AgentRobotHandle`, `findPath(start, goal, opts)`, `buildEffectiveBlockedCells(items, base, opts)`, `findFreeCell(anchor, blocked, opts)`, `worldToCell(x, z)`, and `AGENT_START_CELL` are defined once (Task 1/2/4/5) and reused verbatim in later tasks and in the e2e spec. `path.slice(1)` convention (robot already on start cell) is consistent between `moveTo` and `onPathChange`.
- **Baseline protection:** `OfficeLockedScene`, `OfficeModel`, the camera profile, postprocessing, and the 60-item baseline are untouched; `AgentLayer` is additive in `VoxelOffice`'s static branch. The existing e2e test keeps all its assertions.
- **Performance contract:** idle = `demand`; walking = `always`; arrival = `demand` + `invalidate()`; unmount cleanup restores `demand`. The path preview is off by default.
- **Known tradeoffs:** (1) the locked scene is not grid-aligned, so path blocking merges floor-level locked items as a best-effort heuristic (walls always block; elevated decor does not); the grid contract remains authoritative for M3. (2) R3F passes pointer events through objects without handlers, so clicks on furniture fall through to the nav floor and are ignored via the blocked-goal check — if a click lands on the robot itself it is a no-op (same cell). (3) `processing`/`error` faces are implemented but not triggered until M3/M4.

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-07-milestone-2-agent-robots.md`.**

The user reviews and approves this plan before any execution begins. Two execution options once approved:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints for review.

No code has been modified by this planning pass; the working tree remains clean.
