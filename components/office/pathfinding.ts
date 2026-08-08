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
