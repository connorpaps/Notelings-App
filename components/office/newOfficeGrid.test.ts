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
    expect(NEW_OFFICE_BLOCKED_CELLS.size).toBeGreaterThan(400) // walls + low furniture
    expect(NEW_OFFICE_BLOCKED_CELLS.size).toBeLessThan(1500) // still mostly open floor
  })

  it('keeps the exterior shell sealed (rows 0-1 solid; row 2 door thresholds open)', () => {
    // Rows 0-1 are the solid exterior wall. Row 2 holds the three front-door
    // thresholds the user hand-painted open in the 2026-08-12 lock-in; the
    // rest of row 2 stays wall.
    for (let c = 0; c < NEW_OFFICE_GRID_COLS; c += 1) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${c},0`), `front wall cell ${c},0`).toBe(true)
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${c},1`), `front wall cell ${c},1`).toBe(true)
    }
    const doorThresholds = new Set(['2,2', '3,2', '17,2', '18,2', '28,2', '29,2', '30,2'])
    for (let c = 0; c < NEW_OFFICE_GRID_COLS; c += 1) {
      const key = `${c},2`
      expect(NEW_OFFICE_BLOCKED_CELLS.has(key), `row 2 cell ${key}`).toBe(!doorThresholds.has(key))
    }
  })

  it('leaves the glass-room doorways walk-through-able', () => {
    // The manager's room glass partition (row 29): the west door frame (cols
    // 20-24) stays open; the main doorway narrowed to cols 36-37 in the
    // 2026-08-12 lock-in (jambs 35 and 38-41 are now wall).
    for (const c of [22, 23, 36, 37]) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${c},29`), `doorway cell ${c},29 should be free`).toBe(false)
    }
    // The partition itself stays wall, including the narrowed door jambs.
    for (const c of [27, 35, 38, 40]) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${c},29`), `wall cell ${c},29 should be blocked`).toBe(true)
    }
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

  it('keeps the reception/storage pocket blocked while preserving the work doorway route', () => {
    // The GLB contains low desk/storage geometry below the old 0.2m raster
    // floor threshold. These cells must stay blocked so the visible robot body
    // cannot enter the furniture pocket; the corridor carve must still leave
    // the measured glass-room doorway route connected.
    for (const cell of [[33, 31], [33, 32]]) {
      expect(NEW_OFFICE_BLOCKED_CELLS.has(`${cell[0]},${cell[1]}`), `low furniture cell ${cell}`).toBe(true)
    }
    const path = findPath(NEW_OFFICE_AGENT_START_CELLS.blue, TASK_DESTINATIONS.whiteboard, OPTS)
    expect(path, 'work path remains reachable after low-furniture rasterization').not.toBeNull()
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
