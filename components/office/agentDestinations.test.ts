import { describe, expect, it } from 'vitest'
import { AGENT_GRID_COLS, AGENT_GRID_ROWS, AGENT_GRID_TRANSFORM, AGENT_START_CELL, AGENT_START_CELLS, buildAgentBlockedCells } from './agentGrid'
import { TASK_DESTINATIONS, TASK_DESTINATION_ANCHORS, TRASH_LOCKED_ASSET_ID, TRASH_LOCKED_ITEM_ID, TRASH_STAGING_CELL, WORK_WHITEBOARD_LOCKED_ASSET_ID, WORK_WHITEBOARD_LOCKED_ITEM_ID, CORKBOARD_LOCKED_ASSET_ID, CORKBOARD_LOCKED_ITEM_ID } from './agentDestinations'
import { createSafePathCurve, findPath, gridCellToWorld, isPathSafe, ROBOT_NAVIGATION_CLEARANCE, worldToGridCell } from './pathfinding'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'

describe('agent destinations', () => {
  it('keeps both robot starts free and connected', () => {
    const blocked = buildAgentBlockedCells()
    expect(AGENT_START_CELL).toEqual([6, 12])
    expect(AGENT_START_CELLS).toEqual({ blue: [6, 12], green: [4, 12] })
    // The corkboard staging sits on the same back-wall aisle as the whiteboard
    // staging; [25,4]/[26,4] are blocked by Table White 2x2 01.
    expect(TASK_DESTINATIONS.corkboard).toEqual([27, 4])
    expect(TASK_DESTINATION_ANCHORS.corkboard).toEqual([25, 3])
    expect(blocked.has('27,4')).toBe(false)
    expect(blocked.has('25,4')).toBe(true)
    for (const cell of Object.values(AGENT_START_CELLS)) {
      expect(blocked.has(`${cell[0]},${cell[1]}`)).toBe(false)
      expect(findPath(AGENT_START_CELL, cell, { blocked, cols: AGENT_GRID_COLS, rows: AGENT_GRID_ROWS })).not.toBeNull()
    }
  })

  it('keeps named destinations free, in bounds, and reachable', () => {
    const blocked = buildAgentBlockedCells()
    for (const [name, goal] of Object.entries(TASK_DESTINATIONS)) {
      expect(goal[0]).toBeGreaterThanOrEqual(0)
      expect(goal[0]).toBeLessThan(AGENT_GRID_COLS)
      expect(goal[1]).toBeGreaterThanOrEqual(0)
      expect(goal[1]).toBeLessThan(AGENT_GRID_ROWS)
      expect(blocked.has(`${goal[0]},${goal[1]}`)).toBe(false)
      expect(findPath(AGENT_START_CELL, goal, { blocked, cols: AGENT_GRID_COLS, rows: AGENT_GRID_ROWS })).not.toBeNull()
      expect(name in TASK_DESTINATION_ANCHORS).toBe(true)
    }
  })

  it('keeps both task routes physically safe under the robot clearance envelope', () => {
    const blocked = buildAgentBlockedCells()
    for (const goal of Object.values(TASK_DESTINATIONS)) {
      const path = findPath(AGENT_START_CELL, goal, {
        blocked,
        cols: AGENT_GRID_COLS,
        rows: AGENT_GRID_ROWS,
      })
      expect(path).not.toBeNull()
      expect(isPathSafe(path!, AGENT_GRID_TRANSFORM, blocked, {
        clearanceWorld: ROBOT_NAVIGATION_CLEARANCE,
      })).toBe(true)
      // A rejected spline is valid behavior: AgentRobot then uses the
      // collision-checked orthogonal fallback. The isPathSafe assertion above
      // covers that fallback; if a curve exists, it must have real length.
      const curve = createSafePathCurve(path!, AGENT_GRID_TRANSFORM, blocked, {
        clearanceWorld: ROBOT_NAVIGATION_CLEARANCE,
      })
      if (curve) expect(curve.getLength()).toBeGreaterThan(0)
    }
  })

  it('binds the Work destination to the exact locked Whiteboard 02 item', () => {
    expect(WORK_WHITEBOARD_LOCKED_ITEM_ID).toBe('asset:misc-office-misc-w-ed322119')
    expect(WORK_WHITEBOARD_LOCKED_ASSET_ID).toBe('asset:misc-office-misc-whiteboard-02')
  })

  it('binds the corkboard destination to the exact locked board item', () => {
    expect(CORKBOARD_LOCKED_ITEM_ID).toBe('asset:misc-office-misc-w-40665142')
    expect(CORKBOARD_LOCKED_ASSET_ID).toBe('asset:misc-office-misc-wall-corkboard-02')
  })

  it('binds the trash destination to the locked trash can and a free reachable staging cell', () => {
    const blocked = buildAgentBlockedCells()
    expect(TRASH_LOCKED_ITEM_ID).toBe('asset:misc-trashcans-off-ad2d51bd')
    expect(TRASH_LOCKED_ASSET_ID).toBe('asset:misc-trashcans-office-misc-trashcan-small-03')
    const item = LOCKED_DEFAULT_ITEMS.find((entry) => entry.id === TRASH_LOCKED_ITEM_ID)
    expect(item).toBeDefined()
    expect(item!.assetId).toBe(TRASH_LOCKED_ASSET_ID)
    const [col, row] = TRASH_STAGING_CELL
    expect(col).toBeGreaterThanOrEqual(0)
    expect(col).toBeLessThan(AGENT_GRID_COLS)
    expect(row).toBeGreaterThanOrEqual(0)
    expect(row).toBeLessThan(AGENT_GRID_ROWS)
    expect(blocked.has(`${col},${row}`)).toBe(false)
    expect(findPath(AGENT_START_CELL, TRASH_STAGING_CELL, { blocked, cols: AGENT_GRID_COLS, rows: AGENT_GRID_ROWS })).not.toBeNull()
    const itemCell = worldToGridCell(item!.transform.position[0], item!.transform.position[2], AGENT_GRID_TRANSFORM)
    expect(Math.hypot(col - itemCell[0], row - itemCell[1])).toBeLessThanOrEqual(1.5)
  })

  it('keeps destination anchors tied to the locked asset positions', () => {
    // The task must target the lower-right locked Whiteboard 02 asset—the
    // board that visibly carries the Work lettering—not the lounge-side
    // Whiteboard 01 asset at [24, 10].
    expect(TASK_DESTINATION_ANCHORS.whiteboard).toEqual([29, 3])
    expect(TASK_DESTINATION_ANCHORS.printer).toEqual([28, 12])
    expect(TASK_DESTINATION_ANCHORS.corkboard).toEqual([25, 3])
    expect(TASK_DESTINATIONS.whiteboard).toEqual([29, 4])
    expect(TASK_DESTINATIONS.printer).toEqual([30, 13])
    expect(TASK_DESTINATIONS.corkboard).toEqual([27, 4])

    for (const [name, goal] of Object.entries(TASK_DESTINATIONS)) {
      const anchor = TASK_DESTINATION_ANCHORS[name as keyof typeof TASK_DESTINATION_ANCHORS]
      const [goalX, goalZ] = gridCellToWorld(goal, AGENT_GRID_TRANSFORM)
      const [anchorX, anchorZ] = gridCellToWorld(anchor, AGENT_GRID_TRANSFORM)
      expect(Math.hypot(goalX - anchorX, goalZ - anchorZ)).toBeLessThan(3.1)
      if (name === 'whiteboard') expect(Math.hypot(goalX - anchorX, goalZ - anchorZ)).toBeLessThan(0.6)
      expect(worldToGridCell(anchorX, anchorZ, AGENT_GRID_TRANSFORM)).toEqual(anchor)
    }
  })
})
