import { describe, expect, it } from 'vitest'
import {
  TASK_DESTINATIONS,
  TASK_DESTINATION_LABELS,
  TASK_DESTINATION_ANCHORS,
  TRASH_STAGING_CELL,
} from './agentDestinations'
import { NEW_OFFICE_AGENT_START_CELLS, NEW_OFFICE_RED_START_CELL } from './newOfficeGrid'
import { NEW_OFFICE_GRID_COLS, NEW_OFFICE_GRID_ROWS, NEW_OFFICE_GRID_TRANSFORM } from './newOfficeLayout'
import { NEW_OFFICE_BLOCKED_CELLS } from './newOfficeGridData'
import { findPath, gridCellToWorld } from './pathfinding'

const GRID_OPTS = { blocked: NEW_OFFICE_BLOCKED_CELLS, cols: NEW_OFFICE_GRID_COLS, rows: NEW_OFFICE_GRID_ROWS }

describe('new-office task destinations', () => {
  it('maps the three categories to new-office staging cells', () => {
    expect(TASK_DESTINATIONS.whiteboard).toEqual([22, 37]) // Manager's Bookshelf
    expect(TASK_DESTINATIONS.printer).toEqual([34, 4]) // Filing Cabinets
    expect(TASK_DESTINATIONS.corkboard).toEqual([3, 21]) // Hallway Bookshelf
    expect(TRASH_STAGING_CELL).toEqual([26, 8])
  })

  it('exposes the new descriptive labels', () => {
    expect(TASK_DESTINATION_LABELS).toEqual({
      whiteboard: "Manager's Bookshelf",
      printer: 'Filing Cabinets',
      corkboard: 'Hallway Bookshelf',
    })
  })

  it('keeps every staging cell free on the baked blocked map', () => {
    for (const cell of [...Object.values(TASK_DESTINATIONS), TRASH_STAGING_CELL]) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${cell[0]},${cell[1]}`), `cell ${cell} should be free`).toBe(false)
    }
  })

  it('reaches every destination from both robot starts (A* connectivity)', () => {
    for (const start of [...Object.values(NEW_OFFICE_AGENT_START_CELLS), NEW_OFFICE_RED_START_CELL]) {
      for (const [key, goal] of Object.entries(TASK_DESTINATIONS)) {
        const path = findPath(start, goal, GRID_OPTS)
        expect(path, `start ${start} -> ${key} should be reachable`).not.toBeNull()
      }
      expect(findPath(start, TRASH_STAGING_CELL, GRID_OPTS), `start ${start} -> trash`).not.toBeNull()
    }
  })

  it('derives anchors from the GLB coordinates through the new transform', () => {
    expect(TASK_DESTINATION_ANCHORS.whiteboard).toEqual([20, 38])
    expect(TASK_DESTINATION_ANCHORS.printer).toEqual([36, 2])
    expect(TASK_DESTINATION_ANCHORS.corkboard).toEqual([2, 22])
  })

  it('places each staging cell near its anchor (visible delivery)', () => {
    for (const [key, anchor] of Object.entries(TASK_DESTINATION_ANCHORS)) {
      const staging = TASK_DESTINATIONS[key as keyof typeof TASK_DESTINATIONS]
      const distance = Math.abs(staging[0] - anchor[0]) + Math.abs(staging[1] - anchor[1])
      // Dense office: chairs + a desk strip block the immediate cabinet front,
      // so the closest reachable band is 4 cells (1 m) away. Keep the
      // tolerance at the worst measured distance so the visual stays nearby.
      expect(distance, `${key} staging within 4 cells of its anchor`).toBeLessThanOrEqual(4)
      // And the staging cell must not be inside the furniture anchor cell.
      expect(staging.join(',')).not.toBe(anchor.join(','))
    }
  })

  it('keeps destination world positions inside the 42×42 grid', () => {
    for (const cell of [...Object.values(TASK_DESTINATIONS), TRASH_STAGING_CELL]) {
      const [x, z] = gridCellToWorld(cell, NEW_OFFICE_GRID_TRANSFORM)
      expect(Math.abs(x)).toBeLessThanOrEqual(5.26)
      expect(Math.abs(z)).toBeLessThanOrEqual(5.26)
    }
  })
})
