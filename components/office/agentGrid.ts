import { CELL_SIZE, OFFICE_COLS, OFFICE_ROWS } from './officeLayout'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { getBuilderAssets } from './officeBuilderAssets'
import { OFFICE_ASSET_FOOTPRINTS } from './officeAssetFootprints'
import {
  buildEffectiveBlockedCells,
  findFreeCell,
  inflateBlockedCells,
  findOpenStartCell,
  type BlockableItem,
  type GridCell,
  type GridTransform,
  worldToGridCell,
  ROBOT_NAVIGATION_CLEARANCE,
} from './pathfinding'

/**
 * The released office is a free-form composition: the approved floor item is
 * offset and scaled, so anchoring the A* grid to it keeps navigation aligned
 * with the visible floor. The navigation grid is double-resolution relative to
 * the decorative floor grid: 36×28 cells at half the world cell size.
 */
export const AGENT_GRID_RESOLUTION = 2
export const AGENT_GRID_COLS = OFFICE_COLS * AGENT_GRID_RESOLUTION
export const AGENT_GRID_ROWS = OFFICE_ROWS * AGENT_GRID_RESOLUTION

export const AGENT_GRID_TRANSFORM: GridTransform = (() => {
  const floor = LOCKED_DEFAULT_ITEMS.find((item) => item.kind === 'floor')
  if (!floor) {
    return {
      origin: [0, 0],
      scale: [CELL_SIZE / AGENT_GRID_RESOLUTION, CELL_SIZE / AGENT_GRID_RESOLUTION],
      cols: AGENT_GRID_COLS,
      rows: AGENT_GRID_ROWS,
    }
  }
  return {
    origin: [floor.transform.position[0], floor.transform.position[2]],
    scale: [
      (floor.transform.scale[0] * CELL_SIZE) / AGENT_GRID_RESOLUTION,
      (floor.transform.scale[2] * CELL_SIZE) / AGENT_GRID_RESOLUTION,
    ],
    cols: AGENT_GRID_COLS,
    rows: AGENT_GRID_ROWS,
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

/**
 * The two locked cubicles are large 3.2×3.2 assets, but their visual entrances
 * face the aisle between them. Allow a narrow two-row entry strip at the
 * aisle-facing side of each cubicle. Each row contains one aisle threshold and
 * two interior fine cells—just enough for the robot to walk a short distance
 * into the cubicle while the rest of the OBJ footprint stays blocked.
 */
export const CUBICLE_ACCESS_POCKETS: ReadonlyArray<ReadonlyArray<GridCell>> = (() => {
  const cubicles = LOCKED_DEFAULT_ITEMS
    .filter((item) => item.assetId === 'asset:cubicles-office-cubicle-white-05')
    .sort((a, b) => a.transform.position[2] - b.transform.position[2])

  return cubicles.map((item, index) => {
    const [col, row] = worldToGridCell(
      item.transform.position[0],
      item.transform.position[2],
      AGENT_GRID_TRANSFORM,
    )
    // These are measured entrance cells from the locked export, not a generic
    // offset from the model center. The two cubicles have different rotations
    // and neighboring desks/walls, so a symmetric formula opened the wrong
    // cells and overlapped the printer table. Keep the exception explicit and
    // tied to the two known locked instances.
    if (index === 0) {
      return [
        [col + 3, row - 3], [col + 3, row - 2], [col + 3, row - 1],
        [col + 3, row], [col + 3, row + 1], [col + 4, row - 1],
      ] as GridCell[]
    }
    return [
      [col + 3, row + 3], [col + 4, row + 3], [col + 5, row + 3],
      [col + 3, row + 4], [col + 4, row + 4], [col + 5, row + 4],
    ] as GridCell[]
  })
})()

/** Effective blocked cells for the released scene (grid-anchored + footprints). */
export function buildAgentBlockedCells(): Set<string> {
  const items = getAgentBlockableItems()
  const options = {
    transform: AGENT_GRID_TRANSFORM,
    footprints: OFFICE_ASSET_FOOTPRINTS,
    // Deliberately NO legacy base: BLOCKED_CELLS describes the OLD centered
    // layout's furniture (desks/couches/cabinets at different world positions),
    // so merging it under the transform-anchored grid would inject phantom
    // blocked cells mid-floor. The locked scene's own walls + furniture are
    // the source of truth for the released office.
    base: new Set<string>(),
  }
  const isTargetCubicle = (item: BlockableItem) =>
    item.obj?.endsWith('/Cubicles/Office_Cubicle_White_05.obj') ?? false
  const nonCubicleBlocked = buildEffectiveBlockedCells(items.filter((item) => !isTargetCubicle(item)), options)
  const cubicleBlocked = buildEffectiveBlockedCells(items.filter(isTargetCubicle), options)
  const blocked = new Set(nonCubicleBlocked)
  const pocketKeys = new Set(
    CUBICLE_ACCESS_POCKETS.flat().map(([col, row]) => `${col},${row}`),
  )

  // Targeted access only: remove cubicle occupancy from a pocket, but never
  // erase a wall/table/chair that independently occupies the same cell. The
  // previous implementation deleted from the merged set and accidentally
  // turned the printer table's cells into walkable floor.
  for (const key of cubicleBlocked) {
    if (!pocketKeys.has(key) || nonCubicleBlocked.has(key)) blocked.add(key)
  }
  return inflateBlockedCells(blocked, AGENT_GRID_TRANSFORM, ROBOT_NAVIGATION_CLEARANCE)
}

/**
 * Robot start: nearest free cell to the lounge front inside the largest
 * connected walkable region, so the robot is never blocked or sealed into a
 * dead-end furniture pocket.
 */
const AGENT_BLOCKED_CELLS = buildAgentBlockedCells()

export const AGENT_START_CELL: GridCell =
  findOpenStartCell([6, 12], AGENT_BLOCKED_CELLS, {
    cols: AGENT_GRID_COLS,
    rows: AGENT_GRID_ROWS,
  }) ?? [18, 14]

/** Stable second spawn cell, resolved from the same released-office obstacle map. */
export const AGENT_START_CELLS: Record<'blue' | 'green', GridCell> = {
  blue: AGENT_START_CELL,
  green: findFreeCell([4, 12], AGENT_BLOCKED_CELLS, {
    cols: AGENT_GRID_COLS,
    rows: AGENT_GRID_ROWS,
  }) ?? [4, 12],
}
