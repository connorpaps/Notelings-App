// Single source of truth for the M1 office layout.
// Milestone 2's A* nav grid consumes BLOCKED_CELLS and cellToWorld.

export const CELL_SIZE = 1.2 // world units per grid cell
export const OFFICE_COLS = 18
export const OFFICE_ROWS = 14
export const OFFICE_WIDTH = OFFICE_COLS * CELL_SIZE
export const OFFICE_DEPTH = OFFICE_ROWS * CELL_SIZE
export const OFFICE_CENTER: [number, number] = [-CELL_SIZE / 2, -CELL_SIZE / 2]
export const WALL_HEIGHT = 3.4
export const WALL_THICKNESS = 0.25

export type ModelPlacement = {
  id: string
  name: string
  obj: string
  mtl: string
  cell: [number, number]
  rotationY?: number
  scale?: number
  elevationY?: number
  /** World-unit offset toward the room for a left-wall mount. */
  wallOffset?: number
  mount?: 'floor' | 'desktop' | 'wall'
  wallSide?: 'left' | 'right' | 'front' | 'back'
}

export const CAMERA_FACING_WALL_IDS = ['wall-positive-z', 'wall-positive-x'] as const

export type WallSegment = {
  id: string
  cell: [number, number]
  lenCells: number
  axis: 'x' | 'z'
  height: number
  thickness?: number
}

const A = '/models/3D_Office_Obj_Assets'

// The reference is a compact diorama: lounge on the left, a four-station
// central work area, and tall filing cabinets on the far right wall.
export const PLACEMENTS: ModelPlacement[] = [
  { id: 'door', name: 'Office door', obj: `${A}/Misc/Office_Misc_Door_01.obj`, mtl: `${A}/Misc/Office_Misc_Door_01.mtl`, cell: [0, 10], rotationY: Math.PI / 2 },
  { id: 'plant-door-1', name: 'Plant near door', obj: `${A}/Misc/Office_Misc_Plant_01.obj`, mtl: `${A}/Misc/Office_Misc_Plant_01.mtl`, cell: [1, 9] },
  { id: 'plant-door-2', name: 'Plant near door', obj: `${A}/Misc/Office_Misc_Plant_02.obj`, mtl: `${A}/Misc/Office_Misc_Plant_02.mtl`, cell: [1, 12] },

  // The TV's thin local Z axis is rotated onto the left-wall X plane.
  // Keep one TV, flush to the room-facing side of the left/back wall.
  { id: 'tv-wall', name: 'Wall TV', obj: `${A}/Misc/Electronics/Office_Misc_TV_Wall_01.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_TV_Wall_01.mtl`, cell: [0, 4], mount: 'wall', wallSide: 'left', wallOffset: 0.325, rotationY: Math.PI / 2, elevationY: 1.2 },
  // Compensate for the stand/TV OBJ origins so their world-space centers align.
  { id: 'tv-console', name: 'TV stand', obj: `${A}/Misc/Electronics/Office_Misc_TV_Stand_01.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_TV_Stand_01.mtl`, cell: [0, 4], wallSide: 'left', wallOffset: -0.175, rotationY: Math.PI / 2 },
  { id: 'couch-white', name: 'White lounge couch', obj: `${A}/Chairs/Office_Couch_White_01.obj`, mtl: `${A}/Chairs/Office_Couch_White_01.mtl`, cell: [4, 4], rotationY: Math.PI / 2 },
  // Turn the bottom couch 180° so it faces the TV and the other couch.
  { id: 'couch-black', name: 'Black lounge couch', obj: `${A}/Chairs/Office_Couch_Black_01.obj`, mtl: `${A}/Chairs/Office_Couch_Black_01.mtl`, cell: [7, 4], rotationY: -Math.PI / 2 },
  { id: 'coffee-table', name: 'Black coffee table', obj: `${A}/Tables/Office_Table_Coffee_01_Black.obj`, mtl: `${A}/Tables/Office_Table_Coffee_01_Black.mtl`, cell: [5.5, 4], rotationY: Math.PI / 2 },
  { id: 'plant-lounge', name: 'Lounge plant', obj: `${A}/Misc/Office_Misc_Plant_03.obj`, mtl: `${A}/Misc/Office_Misc_Plant_03.mtl`, cell: [8, 3] },

  { id: 'desk-1', name: 'Cubicle desk white 1', obj: `${A}/Cubicles/Office_Cubicle_White_01.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_01.mtl`, cell: [6, 7], rotationY: Math.PI },
  { id: 'desk-2', name: 'Cubicle desk white 2', obj: `${A}/Cubicles/Office_Cubicle_White_02.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_02.mtl`, cell: [10, 7], rotationY: Math.PI },
  { id: 'chair-1', name: 'Office chair 1', obj: `${A}/Chairs/Office_Chair_Black_01.obj`, mtl: `${A}/Chairs/Office_Chair_Black_01.mtl`, cell: [6, 6], rotationY: Math.PI },
  { id: 'chair-2', name: 'Office chair 2', obj: `${A}/Chairs/Office_Chair_Black_02.obj`, mtl: `${A}/Chairs/Office_Chair_Black_02.mtl`, cell: [10, 6], rotationY: Math.PI },
  { id: 'desk-3', name: 'Cubicle desk white 3', obj: `${A}/Cubicles/Office_Cubicle_White_03.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_03.mtl`, cell: [6, 11], rotationY: Math.PI },
  { id: 'desk-4', name: 'Cubicle desk white 4', obj: `${A}/Cubicles/Office_Cubicle_White_04.obj`, mtl: `${A}/Cubicles/Office_Cubicle_White_04.mtl`, cell: [10, 11], rotationY: Math.PI },
  { id: 'chair-3', name: 'Office chair 3', obj: `${A}/Chairs/Office_Chair_Black_01.obj`, mtl: `${A}/Chairs/Office_Chair_Black_01.mtl`, cell: [6, 10], rotationY: Math.PI },
  { id: 'chair-4', name: 'Office chair 4', obj: `${A}/Chairs/Office_Chair_Black_02.obj`, mtl: `${A}/Chairs/Office_Chair_Black_02.mtl`, cell: [10, 10], rotationY: Math.PI },

  { id: 'printer-desk', name: 'White 2x1 table (printer station)', obj: `${A}/Tables/Office_Table_White_2x1_01.obj`, mtl: `${A}/Tables/Office_Table_White_2x1_01.mtl`, cell: [14, 11], rotationY: Math.PI / 2 },
  { id: 'printer-chair', name: 'Office chair (printer)', obj: `${A}/Chairs/Office_Chair_White_01.obj`, mtl: `${A}/Chairs/Office_Chair_White_01.mtl`, cell: [14, 12] },
  { id: 'cabinet-1', name: 'Tall filing cabinet 1', obj: `${A}/Misc/Office_Misc_Cabinet_01.obj`, mtl: `${A}/Misc/Office_Misc_Cabinet_01.mtl`, cell: [16, 5], rotationY: -Math.PI / 2 },
  { id: 'cabinet-2', name: 'Tall filing cabinet 2', obj: `${A}/Misc/Office_Misc_Cabinet_02.obj`, mtl: `${A}/Misc/Office_Misc_Cabinet_02.mtl`, cell: [16, 8], rotationY: -Math.PI / 2 },
  { id: 'plant-front', name: 'Front plant', obj: `${A}/Misc/Office_Misc_Plant_02.obj`, mtl: `${A}/Misc/Office_Misc_Plant_02.mtl`, cell: [15, 2] },
  { id: 'trashcan', name: 'Small trashcan', obj: `${A}/Misc/Trashcans/Office_Misc_Trashcan_Small_01.obj`, mtl: `${A}/Misc/Trashcans/Office_Misc_Trashcan_Small_01.mtl`, cell: [12, 4] },

  { id: 'printer', name: 'Printer', obj: `${A}/Misc/Electronics/Office_Misc_Printer.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_Printer.mtl`, cell: [14, 11], mount: 'desktop', elevationY: 1.1 },
  { id: 'pc-1', name: 'PC monitor 1', obj: `${A}/Misc/Electronics/Office_Misc_PC_01.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_PC_01.mtl`, cell: [6, 7], mount: 'desktop', elevationY: 1.1 },
  { id: 'pc-2', name: 'PC monitor 2', obj: `${A}/Misc/Electronics/Office_Misc_PC_02.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_PC_02.mtl`, cell: [10, 11], mount: 'desktop', elevationY: 1.1 },
  { id: 'phone', name: 'Phone', obj: `${A}/Misc/Electronics/Office_Misc_Phone.obj`, mtl: `${A}/Misc/Electronics/Office_Misc_Phone.mtl`, cell: [10, 7], mount: 'desktop', elevationY: 1.1 },
  { id: 'coffee-machine', name: 'Coffee machine', obj: `${A}/Misc/Coffee/Office_Misc_Coffee_Machine_01.obj`, mtl: `${A}/Misc/Coffee/Office_Misc_Coffee_Machine_01.mtl`, cell: [5, 4], mount: 'desktop', elevationY: 0.55 },
  { id: 'coffee-pot', name: 'Coffee pot', obj: `${A}/Misc/Coffee/Office_Misc_Coffee_Pot_01.obj`, mtl: `${A}/Misc/Coffee/Office_Misc_Coffee_Pot_01.mtl`, cell: [5.4, 4], mount: 'desktop', elevationY: 0.55 },
  { id: 'mug', name: 'Coffee mug', obj: `${A}/Misc/Coffee/Office_Misc_Coffee_Mug.obj`, mtl: `${A}/Misc/Coffee/Office_Misc_Coffee_Mug.mtl`, cell: [4.6, 4], mount: 'desktop', elevationY: 0.55 },
  { id: 'papers', name: 'Papers', obj: `${A}/Misc/Office_Misc_Papers.obj`, mtl: `${A}/Misc/Office_Misc_Papers.mtl`, cell: [6.4, 7.2], mount: 'desktop', elevationY: 1.1 },
  { id: 'organizer', name: 'Organizer', obj: `${A}/Misc/Office_Misc_Organizer.obj`, mtl: `${A}/Misc/Office_Misc_Organizer.mtl`, cell: [10.4, 11.2], mount: 'desktop', elevationY: 1.1 },

  { id: 'wall-clock', name: 'Wall clock', obj: `${A}/Misc/Office_Misc_Wall_Clock_01.obj`, mtl: `${A}/Misc/Office_Misc_Wall_Clock_01.mtl`, cell: [17.4, 3], mount: 'wall', rotationY: Math.PI / 2, elevationY: 2.6 },
  { id: 'whiteboard', name: 'Whiteboard', obj: `${A}/Misc/Office_Misc_Whiteboard_01.obj`, mtl: `${A}/Misc/Office_Misc_Whiteboard_01.mtl`, cell: [17.4, 6.5], mount: 'wall', rotationY: Math.PI / 2, elevationY: 2.2 },
  { id: 'corkboard', name: 'Corkboard', obj: `${A}/Misc/Office_Misc_Wall_Corkboard_01.obj`, mtl: `${A}/Misc/Office_Misc_Wall_Corkboard_01.mtl`, cell: [17.4, 10], mount: 'wall', rotationY: Math.PI / 2, elevationY: 2.2 },
]

// Camera-facing positive-Z and positive-X runs are deliberately omitted for
// the open-front dollhouse view. The negative-Z wall and the split negative-X
// wall retain the rear shell and doorway without blocking the camera.
export const WALLS: WallSegment[] = [
  { id: 'wall-negative-z', cell: [0, 0], lenCells: 18, axis: 'x', height: WALL_HEIGHT, thickness: WALL_THICKNESS },
  { id: 'wall-left-upper', cell: [0, 1], lenCells: 9, axis: 'z', height: WALL_HEIGHT, thickness: WALL_THICKNESS },
  { id: 'wall-left-lower', cell: [0, 12], lenCells: 2, axis: 'z', height: WALL_HEIGHT, thickness: WALL_THICKNESS },
]

export function cellToWorld(col: number, row: number): [number, number] {
  return [(col - OFFICE_COLS / 2) * CELL_SIZE, (row - OFFICE_ROWS / 2) * CELL_SIZE]
}

/** Convert world [x, z] to the nearest grid cell [col, row] (inverse of cellToWorld). */
export function worldToCell(x: number, z: number): [number, number] {
  // + 0 normalizes the -0 that Math.round can produce from tiny negative
  // float errors (e.g. -10.8 / 1.2 + 9), so tests compare +0 cleanly.
  const col = Math.round(x / CELL_SIZE + OFFICE_COLS / 2) + 0
  const row = Math.round(z / CELL_SIZE + OFFICE_ROWS / 2) + 0
  return [col, row]
}

export const BLOCKED_CELLS: Set<string> = new Set(
  PLACEMENTS.filter((p) => (p.mount ?? 'floor') === 'floor').map(
    (p) => `${p.cell[0]},${p.cell[1]}`,
  ),
)
