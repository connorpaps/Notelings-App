import * as THREE from 'three'
import {
  BLOCKED_CELLS,
  CELL_SIZE,
  OFFICE_COLS,
  OFFICE_ROWS,
  WALL_THICKNESS,
} from './officeLayout'

export type GridCell = [number, number]
export type BlockedSet = ReadonlySet<string>

/** Physical center clearance used by the fine agent grid and safe movement. */
export const ROBOT_NAVIGATION_CLEARANCE = 0.22

/**
 * Expand raw occupied cells by a world-space robot clearance. This is kept
 * separate from footprint rasterization so callers can preserve intentional
 * access pockets without accidentally deleting another item's occupancy, then
 * apply the same physical clearance consistently to every obstacle.
 */
export function inflateBlockedCells(
  blocked: BlockedSet,
  transform: GridTransform,
  clearanceWorld: number,
): Set<string> {
  const cols = transform.cols ?? OFFICE_COLS
  const rows = transform.rows ?? OFFICE_ROWS
  const clearance = Math.max(0, clearanceWorld)
  if (clearance === 0) return new Set(blocked)

  const blockedCenters = [...blocked].map((key) => {
    const [col, row] = key.split(',').map(Number)
    const [x, z] = gridCellToWorld([col, row], transform)
    return { x, z }
  })
  const halfX = Math.abs(transform.scale[0]) / 2
  const halfZ = Math.abs(transform.scale[1]) / 2
  const expanded = new Set(blocked)

  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const [x, z] = gridCellToWorld([col, row], transform)
      if (blockedCenters.some((rect) => {
        const dx = Math.max(Math.abs(x - rect.x) - halfX, 0)
        const dz = Math.max(Math.abs(z - rect.z) - halfZ, 0)
        return Math.hypot(dx, dz) <= clearance
      })) {
        expanded.add(`${col},${row}`)
      }
    }
  }
  return expanded
}

/**
 * Maps grid cells to world coordinates. The locked office scene is a free-form
 * composition (offset + scaled floor), so the agent grid anchors to the locked
 * floor item's transform: `origin` is the world position of the center cell
 * (OFFICE_COLS/2, OFFICE_ROWS/2) and `scale` is the world size of one cell on
 * x/z (CELL_SIZE × floor scale). `cols`/`rows` can increase the navigation
 * resolution without changing the decorative floor grid or its world extent.
 */
export type GridTransform = {
  origin: [number, number]
  scale: [number, number]
  cols?: number
  rows?: number
}

function gridDimensions(transform: GridTransform): { cols: number; rows: number } {
  return {
    cols: transform.cols ?? OFFICE_COLS,
    rows: transform.rows ?? OFFICE_ROWS,
  }
}

/** Identity transform centered at world (0,0) with 1:1 CELL_SIZE cells. */
export const DEFAULT_GRID_TRANSFORM: GridTransform = {
  origin: [0, 0],
  scale: [CELL_SIZE, CELL_SIZE],
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
 * A* over the office grid. Orthogonal (4-directional) movement with a Manhattan
 * heuristic. Returns the ordered path [start, ..., goal] inclusive, or null when
 * unreachable or invalid. The navigation grid is still small enough for a
 * simple open-list minimum scan, which is clearer than a binary heap (ponytail).
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

export type Footprint = { width: number; depth: number }

export type BlockableItem = {
  kind: string
  obj?: string
  transform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
  wall?: { axis: 'x' | 'z'; lenCells: number; thickness?: number }
  footprint?: Footprint
}

/**
 * Merge the grid-contract BLOCKED_CELLS with the locked scene's furniture.
 * Every floor-level model item blocks the grid cells its real OBJ footprint
 * (width/depth at scale 1, optionally rotated around Y and scaled) overlaps;
 * walls block by their wall-segment footprint. Items resolve footprints from
 * `opts.footprints` (keyed by obj path) or an explicit `item.footprint`, and
 * fall back to one cell so no item is ever silently walkable. Elevated decor
 * (y >= 0.5) and the floor itself never block. World→cell conversion uses
 * `opts.transform` so blocking aligns with the visible floor grid.
 */
export function buildEffectiveBlockedCells(
  items: ReadonlyArray<BlockableItem>,
  opts: {
    base?: BlockedSet
    cols?: number
    rows?: number
    transform?: GridTransform
    footprints?: Record<string, Footprint>
    clearanceWorld?: number
  } = {},
): Set<string> {
  const transform = opts.transform ?? DEFAULT_GRID_TRANSFORM
  const cols = opts.cols ?? transform.cols ?? OFFICE_COLS
  const rows = opts.rows ?? transform.rows ?? OFFICE_ROWS
  const blocked = new Set(opts.base ?? BLOCKED_CELLS)

  const clampCell = (cell: GridCell): GridCell => [
    Math.min(cols - 1, Math.max(0, cell[0])),
    Math.min(rows - 1, Math.max(0, cell[1])),
  ]

  for (const item of items) {
    const isWall = item.kind === 'wall'
    const onFloor = item.kind === 'model' && item.transform.position[1] < 0.5
    if (!isWall && !onFloor) continue

    let footprint: Footprint
    if (isWall && item.wall) {
      // Wall definitions use the decorative office cell unit, and the locked
      // scene renders them directly from `lenCells * CELL_SIZE` inside the
      // wall item's own transform. Do not derive wall length from the floor's
      // scaled agent grid: the floor transform is not applied to wall groups.
      const len = item.wall.lenCells * CELL_SIZE
      const thick = item.wall.thickness ?? WALL_THICKNESS
      footprint = item.wall.axis === 'x' ? { width: len, depth: thick } : { width: thick, depth: len }
    } else if (item.obj && opts.footprints?.[item.obj]) {
      footprint = opts.footprints[item.obj]
    } else {
      footprint = item.footprint ?? { width: transform.scale[0], depth: transform.scale[1] }
    }

    const [cx, , cz] = item.transform.position
    const [sx, , sz] = item.transform.scale
    const rotationY = item.transform.rotation[1] ?? 0
    const clearance = Math.max(0, opts.clearanceWorld ?? 0)
    const halfW = (footprint.width * Math.abs(sx)) / 2 + clearance
    const halfD = (footprint.depth * Math.abs(sz)) / 2 + clearance
    const cos = Math.cos(rotationY)
    const sin = Math.sin(rotationY)

    // Rotated box corners around Y, then axis-aligned world AABB. The AABB
    // deliberately INFLATES diagonally-placed footprints (a rotated box's
    // AABB is larger than the box itself) — conservative over-blocking: the
    // robot refuses borderline gaps instead of clipping furniture.
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [lx, lz] of [[halfW, halfD], [halfW, -halfD], [-halfW, halfD], [-halfW, -halfD]] as Array<[number, number]>) {
      const wx = cx + lx * cos + lz * sin
      const wz = cz - lx * sin + lz * cos
      minX = Math.min(minX, wx)
      maxX = Math.max(maxX, wx)
      minZ = Math.min(minZ, wz)
      maxZ = Math.max(maxZ, wz)
    }

    // Mark cells whose finite area overlaps the footprint AABB. Using cell
    // boundaries instead of only rounded centers keeps narrow furniture from
    // disappearing between the finer navigation cells.
    const EPSILON = 1e-9
    // A footprint blocks a cell when its world AABB overlaps the cell area.
    // Exact boundary contact alone does not block the neighboring cell.
    const minCol = Math.ceil((minX - transform.origin[0]) / transform.scale[0] + cols / 2 - 0.5 + EPSILON)
    const maxCol = Math.floor((maxX - transform.origin[0]) / transform.scale[0] + cols / 2 + 0.5 - EPSILON)
    const minRow = Math.ceil((minZ - transform.origin[1]) / transform.scale[1] + rows / 2 - 0.5 + EPSILON)
    const maxRow = Math.floor((maxZ - transform.origin[1]) / transform.scale[1] + rows / 2 + 0.5 - EPSILON)
    const minCell: GridCell = clampCell([minCol, minRow])
    const maxCell: GridCell = clampCell([maxCol, maxRow])
    for (let col = minCell[0]; col <= maxCell[0]; col += 1) {
      for (let row = minCell[1]; row <= maxCell[1]; row += 1) {
        blocked.add(`${col},${row}`)
      }
    }
  }
  return blocked
}

/**
 * Build a Catmull–Rom curve through the A* cell centers. The sampled curve is
 * rejected when it enters a blocked cell, so visual corner smoothing never
 * trades obstacle safety for appearance. A null result tells the caller to
 * retain the exact orthogonal path as a safe fallback.
 *
 * `clearanceWorld` treats each blocked cell as an occupied world-space square
 * and rejects curve samples that enter the robot's clearance radius. Sampling
 * is based on arc length at no more than one quarter of the smallest cell
 * dimension, so a short spline excursion cannot hide between samples.
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
  const cols = transform.cols ?? OFFICE_COLS
  const rows = transform.rows ?? OFFICE_ROWS
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

/**
 * First free in-bounds cell scanning outward from `anchor` ring by ring
 * (Chebyshev radius). Useful for picking a free target near an anchor.
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

/**
 * Free cell nearest `anchor` inside the LARGEST connected free region.
 * Dense footprint blocking can split the floor into isolated pockets; the
 * robot start must live in the dominant region so it can actually reach the
 * office's main walkable hallways.
 */
export function findOpenStartCell(
  anchor: GridCell,
  blocked: BlockedSet,
  opts: { cols?: number; rows?: number } = {},
): GridCell | null {
  const cols = opts.cols ?? OFFICE_COLS
  const rows = opts.rows ?? OFFICE_ROWS
  const free: GridCell[] = []
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (!blocked.has(`${c},${r}`)) free.push([c, r])
    }
  }
  if (free.length === 0) return null

  // Flood-fill the free cells into connected orthogonal regions.
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

  // Nearest cell of the largest region to the anchor (deterministic ring order).
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
