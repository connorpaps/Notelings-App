/**
 * Shared navigation primitives for the released GLB office.
 *
 * The legacy OBJ office had a separate 18×14 layout. Keeping the active
 * defaults here prevents generic A* helpers from importing archived furniture
 * data or accidentally using the old room dimensions.
 */
export type GridCell = [number, number]
export type BlockedSet = ReadonlySet<string>

export const DEFAULT_GRID_COLS = 42
export const DEFAULT_GRID_ROWS = 42
export const DEFAULT_CELL_SIZE = 0.25

export type GridTransform = {
  origin: [number, number]
  scale: [number, number]
  cols?: number
  rows?: number
}

export const DEFAULT_GRID_TRANSFORM: GridTransform = {
  origin: [0, 0],
  scale: [DEFAULT_CELL_SIZE, DEFAULT_CELL_SIZE],
  cols: DEFAULT_GRID_COLS,
  rows: DEFAULT_GRID_ROWS,
}
