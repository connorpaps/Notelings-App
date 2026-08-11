import type { TaskDestination } from '@/lib/notes/types'
import type { GridCell } from './pathfinding'
import { worldToGridCell } from './pathfinding'
import {
  NEW_OFFICE_GRID_TRANSFORM,
  NEW_OFFICE_RECENTER,
  NEW_OFFICE_ANCHORS,
  NEW_OFFICE_DESTINATION_ANCHOR_CELLS,
} from './newOfficeLayout'

// Re-exported so scene code keeps one import surface; the type itself lives in
// the light shared module so the server route never drags in the scene.
export type { TaskDestination } from '@/lib/notes/types'

export type AgentId = 'blue' | 'green' | 'red'

/** Mutable GridCell tuple from the shared verified staging table (as const). */
const staging = (name: keyof typeof NEW_OFFICE_DESTINATION_ANCHOR_CELLS): GridCell => {
  const [col, row] = NEW_OFFICE_DESTINATION_ANCHOR_CELLS[name]
  return [col, row]
}

/**
 * Walkable staging cells in the 3D Note Office, locked against the generated
 * blocked map (42×42 @ 0.25 m) on 2026-08-10: each cell is FREE and
 * A*-reachable from both robot starts, chosen as the closest free cell to the
 * destination furniture:
 *   whiteboard → Manager's Bookshelf [22,37] (anchor (20,38) is blocked by the
 *     shelf + interior wall; the robot stands east of the shelf)
 *   printer → Filing Cabinets [34,4] (anchor (36,2); chairs + a desk strip
 *     block the immediate front, the closest free band is 4 cells north)
 *   corkboard → Hallway Bookshelf [3,21] (anchor (2,22))
 */
export const TASK_DESTINATIONS: Record<TaskDestination, GridCell> = {
  whiteboard: staging('workBookshelf'),
  printer: staging('adminCabinets'),
  corkboard: staging('hallwayBookshelf'),
}

export const TASK_DESTINATION_LABELS: Record<TaskDestination, string> = {
  whiteboard: "Manager's Bookshelf",
  printer: 'Filing Cabinets',
  corkboard: 'Hallway Bookshelf',
}

/**
 * Walkable staging cell at the black trash bin (anchor cell (26,8) is itself
 * free): the M2 agentic-delete flow disposes archived notes here.
 */
export const TRASH_STAGING_CELL: GridCell = staging('trashBin')

/** Exact furniture anchor cells derived from the GLB model coordinates. */
export const TASK_DESTINATION_ANCHORS: Record<TaskDestination, GridCell> = {
  whiteboard: worldToGridCell(
    NEW_OFFICE_ANCHORS.workBookshelf[0] + NEW_OFFICE_RECENTER[0],
    NEW_OFFICE_ANCHORS.workBookshelf[1] + NEW_OFFICE_RECENTER[2],
    NEW_OFFICE_GRID_TRANSFORM,
  ),
  printer: worldToGridCell(
    NEW_OFFICE_ANCHORS.adminCabinets[0] + NEW_OFFICE_RECENTER[0],
    NEW_OFFICE_ANCHORS.adminCabinets[1] + NEW_OFFICE_RECENTER[2],
    NEW_OFFICE_GRID_TRANSFORM,
  ),
  corkboard: worldToGridCell(
    NEW_OFFICE_ANCHORS.hallwayBookshelf[0] + NEW_OFFICE_RECENTER[0],
    NEW_OFFICE_ANCHORS.hallwayBookshelf[1] + NEW_OFFICE_RECENTER[2],
    NEW_OFFICE_GRID_TRANSFORM,
  ),
}
