import { CELL_SIZE } from './officeLayout'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { getBuilderAssets } from './officeBuilderAssets'
import { OFFICE_ASSET_FOOTPRINTS } from './officeAssetFootprints'
import {
  buildEffectiveBlockedCells,
  findOpenStartCell,
  type BlockableItem,
  type GridCell,
  type GridTransform,
} from './pathfinding'

/**
 * The released office is a free-form composition: the approved floor item is
 * offset and scaled, so anchoring the A* grid to it makes every grid cell line
 * up with the visible floor grid squares (cellSize 1.2 × floor scale).
 */
export const AGENT_GRID_TRANSFORM: GridTransform = (() => {
  const floor = LOCKED_DEFAULT_ITEMS.find((item) => item.kind === 'floor')
  if (!floor) return { origin: [0, 0], scale: [CELL_SIZE, CELL_SIZE] }
  return {
    origin: [floor.transform.position[0], floor.transform.position[2]],
    scale: [floor.transform.scale[0] * CELL_SIZE, floor.transform.scale[2] * CELL_SIZE],
  }
})()

/** Locked-scene items resolved into the blockable shape pathfinding expects. */
export function getAgentBlockableItems(): BlockableItem[] {
  const assets = getBuilderAssets()
  const byAsset = new Map(assets.map((asset) => [asset.id, asset]))
  return LOCKED_DEFAULT_ITEMS.map((item) => ({
    kind: item.kind,
    obj: byAsset.get(item.assetId)?.obj,
    transform: item.transform,
    wall: item.wall,
  }))
}

/** Effective blocked cells for the released scene (grid-anchored + footprints). */
export function buildAgentBlockedCells(): Set<string> {
  return buildEffectiveBlockedCells(getAgentBlockableItems(), {
    transform: AGENT_GRID_TRANSFORM,
    footprints: OFFICE_ASSET_FOOTPRINTS,
    // Deliberately NO legacy base: BLOCKED_CELLS describes the OLD centered
    // layout's furniture (desks/couches/cabinets at different world positions),
    // so merging it under the transform-anchored grid would inject phantom
    // blocked cells mid-floor. The locked scene's own walls + furniture are
    // the source of truth for the released office.
    base: new Set(),
  })
}

/**
 * Robot start: nearest free cell to the lounge front inside the largest
 * connected walkable region, so the robot is never blocked or sealed into a
 * dead-end furniture pocket.
 */
export const AGENT_START_CELL: GridCell =
  findOpenStartCell([3, 6], buildAgentBlockedCells()) ?? [9, 7]
