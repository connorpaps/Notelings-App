import { findFreeCell, findOpenStartCell, type GridCell } from './pathfinding'
import { NEW_OFFICE_GRID_COLS, NEW_OFFICE_GRID_ROWS, NEW_OFFICE_GRID_TRANSFORM } from './newOfficeLayout'
import { NEW_OFFICE_BLOCKED_CELLS } from './newOfficeGridData'

/** Single-resolution grid (42×42 at 0.25 m) — no 2× supersampling needed. */
export const NEW_OFFICE_GRID_RESOLUTION = 1

const GRID_OPTS = { cols: NEW_OFFICE_GRID_COLS, rows: NEW_OFFICE_GRID_ROWS }

/**
 * Blue spawns near the big entrance; green spawns near the front-right door.
 * After the 2026-08-12 lock-in the front-right door threshold (30,2) is free,
 * so green resolves there directly; blue's anchor (9,5) stays blocked, so it
 * resolves to the largest connected region (fallback [5,11]).
 */
export const NEW_OFFICE_AGENT_START_CELLS: Record<'blue' | 'green', GridCell> = {
  blue: findOpenStartCell([9, 5], NEW_OFFICE_BLOCKED_CELLS, GRID_OPTS) ?? [5, 11],
  green: findFreeCell([30, 2], NEW_OFFICE_BLOCKED_CELLS, GRID_OPTS) ?? [30, 4],
}

/**
 * Red error sentinel spawns beside the reception desk. Resolved from the
 * LARGEST connected region (findFreeCell's nearest-free semantics can land in
 * a dead-end pocket behind the desk — red must reach every destination).
 * The fallback [32, 18] is a currently-free cell (the anchor (37,21) is the
 * desk itself and is blocked).
 */
export const NEW_OFFICE_RED_START_CELL: GridCell =
  findOpenStartCell([37, 21], NEW_OFFICE_BLOCKED_CELLS, GRID_OPTS) ?? [32, 18]

/** Baked + clearance-inflated blocked set (see newOfficeGridData.ts). */
export const NEW_OFFICE_EFFECTIVE_BLOCKED = NEW_OFFICE_BLOCKED_CELLS

export { NEW_OFFICE_GRID_TRANSFORM }
