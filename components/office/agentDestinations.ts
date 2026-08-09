import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import type { GridCell } from './pathfinding'
import { AGENT_GRID_TRANSFORM } from './agentGrid'
import { worldToGridCell } from './pathfinding'
import type { TaskDestination } from '@/lib/notes/types'

// Re-exported so scene code keeps one import surface; the type itself lives in
// the light shared module so the server route never drags in the scene.
export type { TaskDestination } from '@/lib/notes/types'

export type AgentId = 'blue' | 'green' | 'red'

/**
 * Safe walkable staging cells adjacent to the named locked-scene assets.
 * Whiteboard/Printer were validated in M3; the corkboard staging was measured
 * against the real blocked map: [25,4]/[26,4] are blocked by Table White 2x2 01,
 * so the aisle cell [27,4] is used instead.
 */
export const TASK_DESTINATIONS: Record<TaskDestination, GridCell> = {
  // The user-facing Work whiteboard is the lower-right `Whiteboard 02` wall
  // item, not the similarly named board near the lounge. Stand one fine-grid
  // cell in front of it on the room-facing aisle side.
  whiteboard: [29, 4],
  printer: [30, 13],
  corkboard: [27, 4],
}

export const TASK_DESTINATION_LABELS: Record<TaskDestination, string> = {
  whiteboard: 'Work Whiteboard',
  printer: 'Printer',
  corkboard: 'Corkboard',
}

const WORK_WHITEBOARD_ITEM_ID = 'asset:misc-office-misc-w-ed322119'
const WORK_WHITEBOARD_ASSET_ID = 'asset:misc-office-misc-whiteboard-02'
const WORK_WHITEBOARD_ITEM = LOCKED_DEFAULT_ITEMS.find((item) => item.id === WORK_WHITEBOARD_ITEM_ID)

if (!WORK_WHITEBOARD_ITEM || WORK_WHITEBOARD_ITEM.assetId !== WORK_WHITEBOARD_ASSET_ID) {
  throw new Error('Locked Work Whiteboard item is missing or points to the wrong asset')
}

export const WORK_WHITEBOARD_LOCKED_ITEM_ID = WORK_WHITEBOARD_ITEM_ID
export const WORK_WHITEBOARD_LOCKED_ASSET_ID = WORK_WHITEBOARD_ASSET_ID

const CORKBOARD_ITEM_ID = 'asset:misc-office-misc-w-40665142'
const CORKBOARD_ASSET_ID = 'asset:misc-office-misc-wall-corkboard-02'
const CORKBOARD_ITEM = LOCKED_DEFAULT_ITEMS.find((item) => item.id === CORKBOARD_ITEM_ID)

if (!CORKBOARD_ITEM || CORKBOARD_ITEM.assetId !== CORKBOARD_ASSET_ID) {
  throw new Error('Locked Corkboard item is missing or points to the wrong asset')
}

export const CORKBOARD_LOCKED_ITEM_ID = CORKBOARD_ITEM_ID
export const CORKBOARD_LOCKED_ASSET_ID = CORKBOARD_ASSET_ID

/** World anchors used to keep destination cells tied to the locked export. */
export const TASK_DESTINATION_ANCHORS: Record<TaskDestination, GridCell> = {
  whiteboard: worldToGridCell(
    WORK_WHITEBOARD_ITEM.transform.position[0],
    WORK_WHITEBOARD_ITEM.transform.position[2],
    AGENT_GRID_TRANSFORM,
  ),
  printer: worldToGridCell(3.4132448525146737, -2.4955851123078587, AGENT_GRID_TRANSFORM),
  corkboard: worldToGridCell(
    CORKBOARD_ITEM.transform.position[0],
    CORKBOARD_ITEM.transform.position[2],
    AGENT_GRID_TRANSFORM,
  ),
}
