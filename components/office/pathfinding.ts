import * as THREE from 'three'
import {
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  type BlockedSet,
  type GridCell,
  type GridTransform,
} from './navigationGrid'

export type { BlockedSet, GridCell, GridTransform } from './navigationGrid'
export { DEFAULT_GRID_TRANSFORM } from './navigationGrid'

/** Physical center clearance used by the legacy fine grid and safe movement. */
export const ROBOT_NAVIGATION_CLEARANCE = 0.22

function gridDimensions(transform: GridTransform): { cols: number; rows: number } {
  return {
    cols: transform.cols ?? DEFAULT_GRID_COLS,
    rows: transform.rows ?? DEFAULT_GRID_ROWS,
  }
}

export function gridCellToWorld(cell: GridCell, transform: GridTransform): [number, number] {
  const { cols, rows } = gridDimensions(transform)
  return [
    transform.origin[0] + (cell[0] - cols / 2) * transform.scale[0],
    transform.origin[1] + (cell[1] - rows / 2) * transform.scale[1],
  ]
}

export function worldToGridCell(x: number, z: number, transform: GridTransform): GridCell {
  const { cols, rows } = gridDimensions(transform)
  // + 0 normalizes the -0 that Math.round can produce from tiny float errors.
  const col = Math.round((x - transform.origin[0]) / transform.scale[0] + cols / 2) + 0
  const row = Math.round((z - transform.origin[1]) / transform.scale[1] + rows / 2) + 0
  return [col, row]
}

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
 * A* over the active office grid. Orthogonal (4-directional) movement with a
 * Manhattan heuristic. Returns [start, ..., goal] or null when unreachable.
 */
export function findPath(
  start: GridCell,
  goal: GridCell,
  opts: { blocked?: BlockedSet; cols?: number; rows?: number } = {},
): GridCell[] | null {
  const blocked = opts.blocked ?? new Set<string>()
  const cols = opts.cols ?? DEFAULT_GRID_COLS
  const rows = opts.rows ?? DEFAULT_GRID_ROWS

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
 * Reject an orthogonal path when any segment enters a blocked cell's occupied
 * rectangle or the configured robot clearance envelope.
 */
export function isPathSafe(
  path: ReadonlyArray<GridCell>,
  transform: GridTransform,
  blocked: BlockedSet,
  opts: { clearanceWorld?: number } = {},
): boolean {
  if (path.length < 2) return path.length === 1
  const clearance = Math.max(0, opts.clearanceWorld ?? 0)
  const blockedRects = [...blocked].map((key) => {
    const [col, row] = key.split(',').map(Number)
    const [x, z] = gridCellToWorld([col, row], transform)
    return { x, z }
  })
  const stepSize = Math.max(Math.min(Math.abs(transform.scale[0]), Math.abs(transform.scale[1])) * 0.1, 0.01)

  for (let index = 1; index < path.length; index += 1) {
    const [startX, startZ] = gridCellToWorld(path[index - 1], transform)
    const [endX, endZ] = gridCellToWorld(path[index], transform)
    const distance = Math.hypot(endX - startX, endZ - startZ)
    const samples = Math.max(1, Math.ceil(distance / stepSize))
    for (let sample = 0; sample <= samples; sample += 1) {
      const ratio = sample / samples
      const x = startX + (endX - startX) * ratio
      const z = startZ + (endZ - startZ) * ratio
      for (const rect of blockedRects) {
        const dx = Math.max(Math.abs(x - rect.x) - Math.abs(transform.scale[0]) / 2, 0)
        const dz = Math.max(Math.abs(z - rect.z) - Math.abs(transform.scale[1]) / 2, 0)
        if (Math.hypot(dx, dz) <= clearance) return false
      }
    }
  }
  return true
}

/**
 * Build a collision-safe Catmull–Rom curve for an orthogonal A* path. Returns
 * null so the caller can use the exact orthogonal path when a curve samples a
 * blocked cell or leaves the configured grid.
 */
export function createSafePathCurve(
  path: ReadonlyArray<GridCell>,
  transform: GridTransform,
  blocked: BlockedSet,
  opts: { clearanceWorld?: number; startWorld?: [number, number] } = {},
): THREE.CatmullRomCurve3 | null {
  if (path.length < 2) return null
  const points = path.map(([col, row], index) => {
    const [x, z] = gridCellToWorld([col, row], transform)
    if (index === 0 && opts.startWorld) return new THREE.Vector3(opts.startWorld[0], 0, opts.startWorld[1])
    return new THREE.Vector3(x, 0, z)
  })
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
  const curveLength = curve.getLength()
  const minCellSize = Math.min(Math.abs(transform.scale[0]), Math.abs(transform.scale[1]))
  const samples = Math.max(32, Math.ceil(curveLength / Math.max(minCellSize * 0.25, 0.01)))
  const cols = transform.cols ?? DEFAULT_GRID_COLS
  const rows = transform.rows ?? DEFAULT_GRID_ROWS
  const clearance = Math.max(0, opts.clearanceWorld ?? 0)
  const blockedRects = [...blocked].map((key) => {
    const [col, row] = key.split(',').map(Number)
    const [x, z] = gridCellToWorld([col, row], transform)
    return { x, z }
  })

  for (let index = 0; index <= samples; index += 1) {
    const point = curve.getPointAt(index / samples)
    const cell = worldToGridCell(point.x, point.z, transform)
    if (!inBounds(cell, cols, rows)) return null
    for (const rect of blockedRects) {
      const dx = Math.max(Math.abs(point.x - rect.x) - Math.abs(transform.scale[0]) / 2, 0)
      const dz = Math.max(Math.abs(point.z - rect.z) - Math.abs(transform.scale[1]) / 2, 0)
      if (Math.hypot(dx, dz) <= clearance) return null
    }
  }
  return curve
}

/** First free in-bounds cell scanning outward from an anchor ring by ring. */
export function findFreeCell(
  anchor: GridCell,
  blocked: BlockedSet,
  opts: { cols?: number; rows?: number } = {},
): GridCell | null {
  const cols = opts.cols ?? DEFAULT_GRID_COLS
  const rows = opts.rows ?? DEFAULT_GRID_ROWS
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

/**
 * Find the nearest cell in the largest connected free region. Robot starts use
 * this instead of a merely local free-cell search so every destination remains
 * reachable in the dense GLB map.
 */
export function findOpenStartCell(
  anchor: GridCell,
  blocked: BlockedSet,
  opts: { cols?: number; rows?: number } = {},
): GridCell | null {
  const cols = opts.cols ?? DEFAULT_GRID_COLS
  const rows = opts.rows ?? DEFAULT_GRID_ROWS
  const free: GridCell[] = []
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (!blocked.has(`${c},${r}`)) free.push([c, r])
    }
  }
  if (free.length === 0) return null

  const unvisited = new Set(free.map(cellKey))
  let best: GridCell[] = []
  while (unvisited.size > 0) {
    const seed = free.find((cell) => unvisited.has(cellKey(cell)))!
    const region: GridCell[] = []
    const queue: GridCell[] = [seed]
    unvisited.delete(cellKey(seed))
    while (queue.length > 0) {
      const current = queue.pop()!
      region.push(current)
      for (const [dx, dz] of NEIGHBORS) {
        const next: GridCell = [current[0] + dx, current[1] + dz]
        if (!inBounds(next, cols, rows)) continue
        const key = cellKey(next)
        if (!unvisited.has(key)) continue
        unvisited.delete(key)
        queue.push(next)
      }
    }
    if (region.length > best.length) best = region
  }
  if (best.length === 0) return null

  for (let radius = 0; radius <= Math.max(cols, rows); radius += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
        const candidate: GridCell = [anchor[0] + dc, anchor[1] + dr]
        if (!inBounds(candidate, cols, rows)) continue
        if (best.some(([c, r]) => c === candidate[0] && r === candidate[1])) return candidate
      }
    }
  }
  return best[0]
}
