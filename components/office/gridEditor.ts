import type { GridTransform } from './pathfinding'
import { gridCellToWorld } from './pathfinding'
import { NEW_OFFICE_FLOOR } from './newOfficeLayout'

/**
 * Manual grid-editing primitives for the walkable-area debug overlay.
 *
 * The user paints red (walkable) squares by hand over the office floor. Their
 * decisions are stored as DELTAS relative to the baked blocked map (gridEditor
 * store → localStorage), so the navigation map itself is only changed when the
 * final result is locked in via scripts/lock-in-grid.mjs.
 */

/** One manual override: force a cell free (walkable / painted) or blocked. */
export type GridEdit = 'free' | 'blocked'

/** Manual overrides keyed by "col,row". An absent key follows the baked map. */
export type GridEdits = Readonly<Record<string, GridEdit>>

export type FloorBounds = {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

const gridSize = (grid: GridTransform): { cols: number; rows: number } => ({
  cols: grid.cols ?? 42,
  rows: grid.rows ?? 42,
})

/**
 * Free (walkable) cells of a blocked map, clipped to the real floor slab's
 * footprint: a cell is walkable when it is not blocked AND its center sits on
 * the floor. The clip guarantees the debug overlay never paints a tile that
 * floats off the edge of the room (the grid is 10.5 m, the floor ~10.1 m).
 */
export function collectWalkableCells(
  blocked: ReadonlySet<string>,
  grid: GridTransform,
  floor: FloorBounds = NEW_OFFICE_FLOOR,
): string[] {
  const { cols, rows } = gridSize(grid)
  const cells: string[] = []
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const key = `${col},${row}`
      if (blocked.has(key)) continue
      const [x, z] = gridCellToWorld([col, row], grid)
      if (x < floor.minX || x > floor.maxX) continue
      if (z < floor.minZ || z > floor.maxZ) continue
      cells.push(key)
    }
  }
  return cells
}

/** Final blocked set = baked blocked cells + 'blocked' edits − 'free' edits. */
export function applyEdits(blocked: ReadonlySet<string>, edits: GridEdits): Set<string> {
  const merged = new Set(blocked)
  for (const [key, edit] of Object.entries(edits)) {
    if (edit === 'blocked') merged.add(key)
    else merged.delete(key)
  }
  return merged
}

function withoutEdit(edits: GridEdits, key: string): GridEdits {
  if (!(key in edits)) return edits
  const next = { ...edits }
  delete next[key]
  return next
}

function withEdit(edits: GridEdits, key: string, edit: GridEdit): GridEdits {
  return { ...edits, [key]: edit }
}

/**
 * Force a cell to a displayed state (`free` = painted red / walkable). The
 * override is dropped when the requested state matches the baked map, so
 * painting a cell twice (back to its baked state) reverts it.
 */
export function paintEdit(
  bakedBlocked: ReadonlySet<string>,
  edits: GridEdits,
  key: string,
  free: boolean,
): GridEdits {
  return bakedBlocked.has(key) === !free
    ? withoutEdit(edits, key)
    : withEdit(edits, key, free ? 'free' : 'blocked')
}

/**
 * Grid cell key under a world-space point, or null when the point is off the
 * grid or its cell center sits off the floor slab (edits are floor-only).
 */
export function cellKeyAtWorld(
  x: number,
  z: number,
  grid: GridTransform,
  floor: FloorBounds = NEW_OFFICE_FLOOR,
): string | null {
  const { cols, rows } = gridSize(grid)
  const col = Math.round((x - grid.origin[0]) / grid.scale[0] + cols / 2)
  const row = Math.round((z - grid.origin[1]) / grid.scale[1] + rows / 2)
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null
  const [cx, cz] = gridCellToWorld([col, row], grid)
  if (cx < floor.minX || cx > floor.maxX || cz < floor.minZ || cz > floor.maxZ) return null
  return `${col},${row}`
}

/** Sorted "col,row" key list (row-major then col-major) — canonical lock-in order. */
export function sortCellKeys(keys: Iterable<string>): string[] {
  return [...keys].sort((a, b) => {
    const [ca, ra] = a.split(',').map(Number)
    const [cb, rb] = b.split(',').map(Number)
    return ra - rb || ca - cb
  })
}

/** JSON payload the editor copies for scripts/lock-in-grid.mjs. */
export function buildLockPayload(blocked: ReadonlySet<string>, grid: GridTransform): string {
  const { cols, rows } = gridSize(grid)
  return JSON.stringify(
    {
      grid: { cols, rows, cellSize: grid.scale[0] },
      blocked: sortCellKeys(blocked),
      source: 'notelings-grid-editor',
    },
    null,
    2,
  )
}
