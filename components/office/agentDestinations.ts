import type { GridCell } from './pathfinding'
import { AGENT_GRID_TRANSFORM } from './agentGrid'
import { worldToGridCell } from './pathfinding'

export type AgentId = 'blue' | 'green'
export type TaskDestination = 'whiteboard' | 'printer'

/** Safe walkable staging cells adjacent to the named locked-scene assets. */
export const TASK_DESTINATIONS: Record<TaskDestination, GridCell> = {
  // Staging cell in the aisle immediately west of the whiteboard/cubicle wall.
  // [22,10] is deliberately not used: it overlaps the printer table footprint
  // and was previously unblocked accidentally by the cubicle-pocket exception.
  whiteboard: [19, 10],
  printer: [30, 13],
}

export const TASK_DESTINATION_LABELS: Record<TaskDestination, string> = {
  whiteboard: 'Work Whiteboard',
  printer: 'Printer',
}

/** World anchors used to keep destination cells tied to the locked export. */
export const TASK_DESTINATION_ANCHORS: Record<TaskDestination, GridCell> = {
  whiteboard: worldToGridCell(0.8138474504734168, -3.462847103322137, AGENT_GRID_TRANSFORM),
  printer: worldToGridCell(3.4132448525146737, -2.4955851123078587, AGENT_GRID_TRANSFORM),
}
