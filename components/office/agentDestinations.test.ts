import { describe, expect, it } from 'vitest'
import { AGENT_GRID_COLS, AGENT_GRID_ROWS, AGENT_GRID_TRANSFORM, AGENT_START_CELL, AGENT_START_CELLS, buildAgentBlockedCells } from './agentGrid'
import { TASK_DESTINATIONS, TASK_DESTINATION_ANCHORS } from './agentDestinations'
import { createSafePathCurve, findPath, gridCellToWorld, isPathSafe, ROBOT_NAVIGATION_CLEARANCE, worldToGridCell } from './pathfinding'

describe('agent destinations', () => {
  it('keeps both robot starts free and connected', () => {
    const blocked = buildAgentBlockedCells()
    expect(AGENT_START_CELL).toEqual([6, 12])
    expect(AGENT_START_CELLS).toEqual({ blue: [6, 12], green: [4, 12] })
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

  it('keeps destination anchors tied to the locked asset positions', () => {
    expect(TASK_DESTINATION_ANCHORS.whiteboard).toEqual([24, 10])
    expect(TASK_DESTINATION_ANCHORS.printer).toEqual([28, 12])
    expect(TASK_DESTINATIONS.whiteboard).toEqual([19, 10])
    expect(TASK_DESTINATIONS.printer).toEqual([30, 13])

    for (const [name, goal] of Object.entries(TASK_DESTINATIONS)) {
      const anchor = TASK_DESTINATION_ANCHORS[name as keyof typeof TASK_DESTINATION_ANCHORS]
      const [goalX, goalZ] = gridCellToWorld(goal, AGENT_GRID_TRANSFORM)
      const [anchorX, anchorZ] = gridCellToWorld(anchor, AGENT_GRID_TRANSFORM)
      expect(Math.hypot(goalX - anchorX, goalZ - anchorZ)).toBeLessThan(3.1)
      expect(worldToGridCell(anchorX, anchorZ, AGENT_GRID_TRANSFORM)).toEqual(anchor)
    }
  })
})
