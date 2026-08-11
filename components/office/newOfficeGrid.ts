import { findFreeCell, findOpenStartCell, type GridCell } from './pathfinding'
import { NEW_OFFICE_GRID_COLS, NEW_OFFICE_GRID_ROWS, NEW_OFFICE_GRID_TRANSFORM } from './newOfficeLayout'
import { NEW_OFFICE_BLOCKED_CELLS } from './newOfficeGridData'

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

export { NEW_OFFICE_GRID_TRANSFORM }
