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
