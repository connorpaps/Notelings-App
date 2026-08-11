import { describe, expect, it } from 'vitest'
import { NEW_OFFICE_AGENT_START_CELLS, NEW_OFFICE_RED_START_CELL } from './newOfficeGrid'
import { NEW_OFFICE_GRID_COLS, NEW_OFFICE_GRID_ROWS } from './newOfficeLayout'
import { NEW_OFFICE_BLOCKED_CELLS } from './newOfficeGridData'
import { TASK_DESTINATIONS, TRASH_STAGING_CELL } from './agentDestinations'
import { findPath } from './pathfinding'

const OPTS = { blocked: NEW_OFFICE_BLOCKED_CELLS, cols: NEW_OFFICE_GRID_COLS, rows: NEW_OFFICE_GRID_ROWS }

describe('new office grid invariants', () => {
  it('is a 42×42 grid with a sane blocked-cell population', () => {
    expect(NEW_OFFICE_GRID_COLS).toBe(42)
    expect(NEW_OFFICE_GRID_ROWS).toBe(42)
    expect(NEW_OFFICE_BLOCKED_CELLS.size).toBeGreaterThan(400) // walls + furniture
    expect(NEW_OFFICE_BLOCKED_CELLS.size).toBeLessThan(1500) // still mostly open floor
  })

  it('keeps the exterior shell sealed (doors against the real walls stay solid)', () => {
    // User decision 2026-08-10: the exterior door leaves stay closed — robots
    // never cross the shell, so the front wall rows 1-2 must be fully blocked.
    for (let c = 0; c < NEW_OFFICE_GRID_COLS; c += 1) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${c},1`), `front wall cell ${c},1`).toBe(true)
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${c},2`), `front wall cell ${c},2`).toBe(true)
    }
  })

  it('leaves the glass-room doorways walk-through-able', () => {
    // The manager's room glass partition (row 29) has two open doorways: the
    // west door frame (cols 20-24) and the main doorway (cols 35-41).
    for (const c of [22, 23, 36, 37, 40]) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${c},29`), `doorway cell ${c},29 should be free`).toBe(false)
    }
    // The partition itself stays wall.
    expect(NEW_OFFICE_BLOCKED_CELLS.has('27,29')).toBe(true)
  })

  it('spawns all robots on free cells', () => {
    for (const cell of [...Object.values(NEW_OFFICE_AGENT_START_CELLS), NEW_OFFICE_RED_START_CELL]) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${cell[0]},${cell[1]}`), `start ${cell} should be free`).toBe(false)
    }
  })

  it('keeps every robot start connected to every destination', () => {
    const goals = [...Object.values(TASK_DESTINATIONS), TRASH_STAGING_CELL]
    for (const start of [...Object.values(NEW_OFFICE_AGENT_START_CELLS), NEW_OFFICE_RED_START_CELL]) {
      for (const goal of goals) {
        expect(findPath(start, goal, OPTS), `start ${start} -> ${goal}`).not.toBeNull()
      }
    }
  })

  it('keeps the glass-room bookshelf reachable through a real doorway', () => {
    // The Work staging sits behind the z≈6.99 glass partition (grid row 29);
    // the path must cross that line through an open doorway cell, never
    // through the wall.
    const path = findPath(NEW_OFFICE_AGENT_START_CELLS.blue, TASK_DESTINATIONS.whiteboard, OPTS)
    expect(path).not.toBeNull()
    const crossesDoorway = path!.some(
      ([col, row]) => row === 29 && !NEW_OFFICE_BLOCKED_CELLS.has(`${col},${row}`),
    )
    expect(crossesDoorway, 'path should cross the glass partition through a doorway').toBe(true)
  })
})
