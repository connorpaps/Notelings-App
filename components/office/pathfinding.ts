import {
  BLOCKED_CELLS,
  CELL_SIZE,
  OFFICE_COLS,
  OFFICE_ROWS,
  WALL_THICKNESS,
} from './officeLayout'

export type GridCell = [number, number]
export type BlockedSet = ReadonlySet<string>

/**
 * Maps grid cells to world coordinates. The locked office scene is a free-form
 * composition (offset + scaled floor), so the agent grid anchors to the locked
 * floor item's transform: `origin` is the world position of the center cell
 * (OFFICE_COLS/2, OFFICE_ROWS/2) and `scale` is the world size of one cell on
 * x/z (CELL_SIZE × floor scale). This makes A* cells align with the visible
 * floor grid lines.
 */
export type GridTransform = {
  origin: [number, number]
  scale: [number, number]
}

/** Identity transform centered at world (0,0) with 1:1 CELL_SIZE cells. */
export const DEFAULT_GRID_TRANSFORM: GridTransform = {
  origin: [0, 0],
  scale: [CELL_SIZE, CELL_SIZE],
}

export function gridCellToWorld(cell: GridCell, transform: GridTransform): [number, number] {
  return [
    transform.origin[0] + (cell[0] - OFFICE_COLS / 2) * transform.scale[0],
    transform.origin[1] + (cell[1] - OFFICE_ROWS / 2) * transform.scale[1],
  ]
}

export function worldToGridCell(x: number, z: number, transform: GridTransform): GridCell {
  // + 0 normalizes the -0 that Math.round can produce from tiny float errors.
  const col = Math.round((x - transform.origin[0]) / transform.scale[0] + OFFICE_COLS / 2) + 0
  const row = Math.round((z - transform.origin[1]) / transform.scale[1] + OFFICE_ROWS / 2) + 0
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
 * unreachable or invalid. The grid is < 300 cells, so a simple open-list
 * minimum scan is smaller and clearer than a binary heap (ponytail).
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
  } = {},
): Set<string> {
  const cols = opts.cols ?? OFFICE_COLS
  const rows = opts.rows ?? OFFICE_ROWS
  const transform = opts.transform ?? DEFAULT_GRID_TRANSFORM
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
      const len = item.wall.lenCells * CELL_SIZE
      const thick = item.wall.thickness ?? WALL_THICKNESS
      footprint = item.wall.axis === 'x' ? { width: len, depth: thick } : { width: thick, depth: len }
    } else if (item.obj && opts.footprints?.[item.obj]) {
      footprint = opts.footprints[item.obj]
    } else {
      footprint = item.footprint ?? { width: CELL_SIZE, depth: CELL_SIZE }
    }

    const [cx, cy, cz] = item.transform.position
    const [sx, , sz] = item.transform.scale
    const rotationY = item.transform.rotation[1] ?? 0
    const halfW = (footprint.width * Math.abs(sx)) / 2
    const halfD = (footprint.depth * Math.abs(sz)) / 2
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

    const minCell = clampCell(worldToGridCell(minX, minZ, transform))
    const maxCell = clampCell(worldToGridCell(maxX, maxZ, transform))
    for (let col = minCell[0]; col <= maxCell[0]; col += 1) {
      for (let row = minCell[1]; row <= maxCell[1]; row += 1) {
        blocked.add(`${col},${row}`)
      }
    }
  }
  return blocked
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
