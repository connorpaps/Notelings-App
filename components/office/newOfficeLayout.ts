import type { GridTransform } from './pathfinding'

/** The new office model, loaded via drei useGLTF (clean glTF 2.0, no Draco). */
export const NEW_OFFICE_MODEL_PATH = '/models/3D_Note_Office_2/3d_note_office.glb'

/**
 * Measured GLB bbox center (model space): min (-10.0901, -0.2376, -0.1234),
 * max (0.008, 2.0126, 10). The scene is recentered by subtracting this (x/z
 * only); the visible floor surface sits at y ≈ -0.014 (NEW_OFFICE_FLOOR).
 * Guarded by newOfficeLayout.test.ts (bbox drift).
 */
export const NEW_OFFICE_RECENTER: readonly [number, number, number] = [5.041, 0, -4.9383]

/** Navigation grid: 42×42 cells at 0.25 m, centered on world (0,0). */
export const NEW_OFFICE_GRID_COLS = 42
export const NEW_OFFICE_GRID_ROWS = 42
export const NEW_OFFICE_CELL_SIZE = 0.25
export const NEW_OFFICE_GRID_TRANSFORM: GridTransform = {
  origin: [0, 0],
  scale: [NEW_OFFICE_CELL_SIZE, NEW_OFFICE_CELL_SIZE],
  cols: NEW_OFFICE_GRID_COLS,
  rows: NEW_OFFICE_GRID_ROWS,
}

/**
 * The visible walkable slab (`floor.001`) measured from the GLB in world space
 * (after NEW_OFFICE_RECENTER): its top surface sits at y = -0.0141 (the grid
 * y=0 plane is ~1.4 cm above the floor), and its footprint is ~10.06 × 10.11 m
 * with a center within ~1.2 cm of the grid origin (0,0). The debug overlay
 * paints walkable cells only inside this footprint so the pathing area never
 * extends past the real floor. Guarded by newOfficeLayout.test.ts.
 */
export const NEW_OFFICE_FLOOR = {
  topY: -0.0141,
  minX: -5.04,
  maxX: 5.0163,
  minZ: -5.0617,
  maxZ: 5.0514,
} as const

/**
 * Runtime path-safety sweep clearance (world units). The baked blocked map
 * already owns the FULL physical center clearance (the 0.30 m robot body
 * radius, inflated by scripts/generate-new-office-grid.mjs), so the runtime
 * sweep runs with 0 — it only rejects true corner clips. NEVER raise this
 * without re-baking the map: double-counting clearance rejects every path in
 * this dense 0.25 m-cell office (see the 2026-08-10 E2E incident).
 */
export const NEW_OFFICE_CLEARANCE = 0

/** Key spots in MODEL coordinates (verified against the GLB geometry, 2026-08-10). */
export const NEW_OFFICE_ANCHORS = {
  workBookshelf: [-5.32, 9.23], // Manager's Office bookshelf (glass room, back-left corner)
  adminCabinets: [-1.2, 0.19], // grey filing cabinets, bottom-right wall
  hallwayBookshelf: [-9.88, 5.3], // IDEAS shelf between the two left-wall doors
  trashBin: [-3.68, 1.79], // black bin next to the wood desk near the front-right door
  receptionDesk: [-0.93, 4.88], // green Reception_4 desk
  bigEntrance: [-8.15, 0.9],
  frontRightDoor: [-2.74, 0.01],
  leftDoor1: [-10, 4.17],
  leftDoor2: [-10, 6.4],
} as const

/**
 * World staging cells on the 42×42 grid, A*-verified FREE + reachable from
 * every region (see scripts/_tmp_astar_test.mjs during generation). These are
 * the cells the robots stop at, adjacent to the visual destination objects
 * (the exact anchor cells sit ON the furniture and are blocked).
 */
export const NEW_OFFICE_DESTINATION_ANCHOR_CELLS = {
  workBookshelf: [22, 37], // east of the Manager's Office bookshelf
  adminCabinets: [34, 4], // in front of the grey filing cabinets
  hallwayBookshelf: [3, 21], // in front of the IDEAS shelf
  trashBin: [27, 8], // beside the black bin (its own cell is blocked as an obstacle)
  receptionDesk: [32, 18], // in front of the green reception desk
  bigEntrance: [9, 5],
  frontRightDoor: [30, 1],
  leftDoor1: [1, 18],
  leftDoor2: [1, 27],
} as const
