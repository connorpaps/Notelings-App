// Single source of truth for the M1 office layout.
// Milestone 2's A* nav grid consumes BLOCKED_CELLS and cellToWorld.

export const CELL_SIZE = 1.2 // world units per grid cell
export const OFFICE_COLS = 18
export const OFFICE_ROWS = 14
export const WALL_HEIGHT = 3.4
export const WALL_THICKNESS = 0.25

export type ModelPlacement = {
  id: string
  name: string
  obj: string // public-relative path, e.g. /models/3D_Office_Obj_Assets/...
  mtl: string
  cell: [number, number] // [col, row]
  rotationY?: number // radians, multiples of Math.PI / 2
  scale?: number
  elevationY?: number // raise above floor (e.g. desktop items, wall decor)
  mount?: 'floor' | 'desktop' | 'wall' // default 'floor'
}

export type WallSegment = {
  cell: [number, number]
  lenCells: number
  axis: 'x' | 'z'
  height: number
  thickness?: number
}

const A = '/models/3D_Office_Obj_Assets'

// Layout derived from docs/references/preview.png (browser image analysis):
// white-walled room, doorway gap on the left wall with plants, lounge
// (white couch + black coffee table + wall TV) along the back-left, two
// workstation clusters of white cubicle desks with black chairs, printer
// station, two blue cabinets on the right wall, wall clock/whiteboard decor.
export const PLACEMENTS: ModelPlacement[] = [
  // --- Doorway + plants (left wall gap, rows 10-11) ---
  { id: 'door', name: 'Office door', obj: `${A}/Misc/Office_Misc_Door_01.obj`, mtl: `${A}/Misc/Office_Misc_Door_01.mtl`, cell: [0, 10], rotationY: Math.PI / 2 },
  { id: 'plant-door-1', name: 'Plant near door', obj: `${A}/Misc/Office_Misc_Plant_01.obj`, mtl: `${A}/Misc/Office_Misc_Plant_01.mtl`, cell: [1, 9] },
  { id: 'plant-door-2', name: 'Plant near door', obj: `${A}/Misc/Office_Misc_Plant_02.obj`, mtl: `${A}/Misc/Office_Misc_Plant_02.mtl`, cell: [1, 12] },

  // --- Lounge (back-left): couch + coffee table + TV console ---
  { id: 'couch', name: 'White couch', obj: `${A}/Chairs/Office_Couch_White_01.obj`, mtl: `${A}/Chairs/Office_Couch_White_01.mtl`, cell: [3, 10] },
  { id: 'coffee-table', name: 'Black coffee table', obj: `${A}/Tables/Office_Table_Coffee_01_Black.obj`, mtl: `${A}/Tables/Office_Table_Coffee_01_Black.mtl`, cell: [3, 11] },
  { id: 'tv-console', name: 'TV console', obj: `${A}/Misc/Electronics/Office_Misc_TV_Stand_01.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_TV_Stand_01.mtl`, cell: [3, 12] },
  { id: 'plant-lounge', name: 'Lounge plant', obj: `${A}/Misc/Office_Misc_Plant_03.obj`, mtl: `${A}/Misc/Office_Misc_Plant_03.mtl`, cell: [6, 10] },

  // --- Workstation cluster 1 (rows 6/5) ---
  { id: 'desk-1', name: 'Cubicle desk white 1', obj: `${A}/Cubicles/Office_Cubicle_White_01.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_01.mtl`, cell: [7, 6], rotationY: Math.PI },
  { id: 'desk-2', name: 'Cubicle desk white 2', obj: `${A}/Cubicles/Office_Cubicle_White_02.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_02.mtl`, cell: [9, 6], rotationY: Math.PI },
  { id: 'chair-1', name: 'Office chair 1', obj: `${A}/Chairs/Office_Chair_Black_01.obj`, mtl: `${A}/Chairs/Office_Chair_Black_01.mtl`, cell: [7, 5] },
  { id: 'chair-2', name: 'Office chair 2', obj: `${A}/Chairs/Office_Chair_Black_02.obj`, mtl: `${A}/Chairs/Office_Chair_Black_02.mtl`, cell: [9, 5] },

  // --- Workstation cluster 2 (rows 9/8) ---
  { id: 'desk-3', name: 'Cubicle desk white 3', obj: `${A}/Cubicles/Office_Cubicle_White_03.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_03.mtl`, cell: [7, 9], rotationY: Math.PI },
  { id: 'desk-4', name: 'Cubicle desk white 4', obj: `${A}/Cubicles/Office_Cubicle_White_04.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_04.mtl`, cell: [9, 9], rotationY: Math.PI },
  // Pack ships only two black chair variants; reuse them across both clusters.
  { id: 'chair-3', name: 'Office chair 3', obj: `${A}/Chairs/Office_Chair_Black_01.obj`, mtl: `${A}/Chairs/Office_Chair_Black_01.mtl`, cell: [7, 8] },
  { id: 'chair-4', name: 'Office chair 4', obj: `${A}/Chairs/Office_Chair_Black_02.obj`, mtl: `${A}/Chairs/Office_Chair_Black_02.mtl`, cell: [9, 8] },

  // --- Printer station (back-right): white table + chair ---
  { id: 'printer-desk', name: 'White 2x1 table (printer station)', obj: `${A}/Tables/Office_Table_White_2x1_01.obj`, mtl: `${A}/Tables/Office_Table_White_2x1_01.mtl`, cell: [13, 11], rotationY: Math.PI / 2 },
  { id: 'printer-chair', name: 'Office chair (printer)', obj: `${A}/Chairs/Office_Chair_White_01.obj`, mtl: `${A}/Chairs/Office_Chair_White_01.mtl`, cell: [13, 12] },

  // --- Bookshelves (right wall) ---
  { id: 'cabinet-1', name: 'Cabinet 1', obj: `${A}/Misc/Office_Misc_Cabinet_01.obj`, mtl: `${A}/Misc/Office_Misc_Cabinet_01.mtl`, cell: [16, 5], rotationY: -Math.PI / 2 },
  { id: 'cabinet-2', name: 'Cabinet 2', obj: `${A}/Misc/Office_Misc_Cabinet_02.obj`, mtl: `${A}/Misc/Office_Misc_Cabinet_02.mtl`, cell: [16, 7], rotationY: -Math.PI / 2 },

  // --- Decorative plant + trashcan (front-right) ---
  { id: 'plant-front', name: 'Front plant', obj: `${A}/Misc/Office_Misc_Plant_02.obj`, mtl: `${A}/Misc/Office_Misc_Plant_02.mtl`, cell: [15, 2] },
  { id: 'trashcan', name: 'Small trashcan', obj: `${A}/Misc/Trashcans/Office_Misc_Trashcan_Small_01.obj`, mtl: `${A}/Misc/Trashcans/Office_Misc_Trashcan_Small_01.mtl`, cell: [11, 4] },

  // --- Desktop items (mounted on desks/tables) ---
  { id: 'printer', name: 'Printer', obj: `${A}/Misc/Electronics/Office_Misc_Printer.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_Printer.mtl`, cell: [13, 11], mount: 'desktop', elevationY: 1.1 },
  { id: 'pc-1', name: 'PC monitor 1', obj: `${A}/Misc/Electronics/Office_Misc_PC_01.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_PC_01.mtl`, cell: [7, 6], mount: 'desktop', elevationY: 1.1 },
  { id: 'pc-2', name: 'PC monitor 2', obj: `${A}/Misc/Electronics/Office_Misc_PC_02.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_PC_02.mtl`, cell: [9, 9], mount: 'desktop', elevationY: 1.1 },
  { id: 'phone', name: 'Phone', obj: `${A}/Misc/Electronics/Office_Misc_Phone.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_Phone.mtl`, cell: [9, 6], mount: 'desktop', elevationY: 1.1 },
  { id: 'coffee-machine', name: 'Coffee machine', obj: `${A}/Misc/Coffee/Office_Misc_Coffee_Machine_01.obj`, mtl: `${A}/Misc/Coffee/Office_Misc_Coffee_Machine_01.mtl`, cell: [3, 11], mount: 'desktop', elevationY: 0.55 },
  { id: 'coffee-pot', name: 'Coffee pot', obj: `${A}/Misc/Coffee/Office_Misc_Coffee_Pot_01.obj`, mtl: `${A}/Misc/Coffee/Office_Misc_Coffee_Pot_01.mtl`, cell: [3.4, 11], mount: 'desktop', elevationY: 0.55 },
  { id: 'mug', name: 'Coffee mug', obj: `${A}/Misc/Coffee/Office_Misc_Coffee_Mug.obj`, mtl: `${A}/Misc/Coffee/Office_Misc_Coffee_Mug.mtl`, cell: [2.7, 11], mount: 'desktop', elevationY: 0.55 },
  { id: 'papers', name: 'Papers', obj: `${A}/Misc/Office_Misc_Papers.obj`, mtl: `${A}/Misc/Office_Misc_Papers.mtl`, cell: [7.4, 6.4], mount: 'desktop', elevationY: 1.1 },
  { id: 'organizer', name: 'Organizer', obj: `${A}/Misc/Office_Misc_Organizer.obj`, mtl: `${A}/Misc/Office_Misc_Organizer.mtl`, cell: [9.4, 9.4], mount: 'desktop', elevationY: 1.1 },

  // --- Wall decor (mounted on walls) ---
  { id: 'wall-clock', name: 'Wall clock', obj: `${A}/Misc/Office_Misc_Wall_Clock_01.obj`, mtl: `${A}/Misc/Office_Misc_Wall_Clock_01.mtl`, cell: [17.4, 3], mount: 'wall', rotationY: Math.PI / 2, elevationY: 2.6 },
  { id: 'whiteboard', name: 'Whiteboard', obj: `${A}/Misc/Office_Misc_Whiteboard_01.obj`, mtl: `${A}/Misc/Office_Misc_Whiteboard_01.mtl`, cell: [17.4, 6.5], mount: 'wall', rotationY: Math.PI / 2, elevationY: 2.2 },
  { id: 'corkboard', name: 'Corkboard', obj: `${A}/Misc/Office_Misc_Wall_Corkboard_01.obj`, mtl: `${A}/Misc/Office_Misc_Wall_Corkboard_01.mtl`, cell: [17.4, 10], mount: 'wall', rotationY: Math.PI / 2, elevationY: 2.2 },
  { id: 'tv-wall', name: 'Wall TV', obj: `${A}/Misc/Electronics/Office_Misc_TV_Wall_01.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_TV_Wall_01.mtl`, cell: [3.5, 13.35], mount: 'wall', rotationY: Math.PI, elevationY: 2.3 },
]

// White walls with a doorway gap on the left wall (rows 10-11).
export const WALLS: WallSegment[] = [
  { cell: [0, 0], lenCells: 18, axis: 'x', height: WALL_HEIGHT, thickness: WALL_THICKNESS }, // front
  { cell: [0, 13], lenCells: 18, axis: 'x', height: WALL_HEIGHT, thickness: WALL_THICKNESS }, // back
  { cell: [0, 1], lenCells: 9, axis: 'z', height: WALL_HEIGHT, thickness: WALL_THICKNESS }, // left (rows 1-9)
  { cell: [0, 12], lenCells: 2, axis: 'z', height: WALL_HEIGHT, thickness: WALL_THICKNESS }, // left (rows 12-13)
  { cell: [17, 1], lenCells: 13, axis: 'z', height: WALL_HEIGHT, thickness: WALL_THICKNESS }, // right
]

/** Convert grid cell [col, row] to world [x, z] centered on the grid. */
export function cellToWorld(col: number, row: number): [number, number] {
  return [(col - OFFICE_COLS / 2) * CELL_SIZE, (row - OFFICE_ROWS / 2) * CELL_SIZE]
}

/**
 * Every cell occupied by floor-level furniture — consumed by Milestone 2 A*.
 * NOTE: this blocks only each placement's anchor cell, not the full footprint
 * of multi-cell models (2x1 tables, cabinets) and NOT the wall segments
 * (`WALLS`) — M2 must expand this set (wall cells + per-model extents from the
 * OBJ bounding boxes) before pathfinding over it.
 */
export const BLOCKED_CELLS: Set<string> = new Set(
  PLACEMENTS.filter((p) => (p.mount ?? 'floor') === 'floor').map(
    (p) => `${p.cell[0]},${p.cell[1]}`,
  ),
)
