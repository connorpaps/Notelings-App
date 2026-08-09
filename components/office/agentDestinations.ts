import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import type { GridCell } from './pathfinding'
import { AGENT_GRID_TRANSFORM } from './agentGrid'
import { worldToGridCell } from './pathfinding'

export type AgentId = 'blue' | 'green'
export type TaskDestination = 'whiteboard' | 'printer'

/** Safe walkable staging cells adjacent to the named locked-scene assets. */
export const TASK_DESTINATIONS: Record<TaskDestination, GridCell> = {
  // The user-facing Work whiteboard is the lower-right `Whiteboard 02` wall
  // item, not the similarly named board near the lounge. Stand one fine-grid
  // cell in front of it on the room-facing aisle side.
  whiteboard: [29, 4],
  printer: [30, 13],
}

export const TASK_DESTINATION_LABELS: Record<TaskDestination, string> = {
  whiteboard: 'Work Whiteboard',
  printer: 'Printer',
}

const WORK_WHITEBOARD_ITEM_ID = 'asset:misc-office-misc-w-ed322119'
const WORK_WHITEBOARD_ASSET_ID = 'asset:misc-office-misc-whiteboard-02'
const WORK_WHITEBOARD_ITEM = LOCKED_DEFAULT_ITEMS.find((item) => item.id === WORK_WHITEBOARD_ITEM_ID)

if (!WORK_WHITEBOARD_ITEM || WORK_WHITEBOARD_ITEM.assetId !== WORK_WHITEBOARD_ASSET_ID) {
  throw new Error('Locked Work Whiteboard item is missing or points to the wrong asset')
}

export const WORK_WHITEBOARD_LOCKED_ITEM_ID = WORK_WHITEBOARD_ITEM_ID
export const WORK_WHITEBOARD_LOCKED_ASSET_ID = WORK_WHITEBOARD_ASSET_ID

/** World anchors used to keep destination cells tied to the locked export. */
export const TASK_DESTINATION_ANCHORS: Record<TaskDestination, GridCell> = {
  whiteboard: worldToGridCell(
    WORK_WHITEBOARD_ITEM.transform.position[0],
    WORK_WHITEBOARD_ITEM.transform.position[2],
    AGENT_GRID_TRANSFORM,
  ),
  printer: worldToGridCell(3.4132448525146737, -2.4955851123078587, AGENT_GRID_TRANSFORM),
}
