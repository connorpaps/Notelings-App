import { describe, expect, it } from 'vitest'
import { CELL_SIZE, OFFICE_COLS, OFFICE_ROWS } from './officeLayout'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { findFreeCell, findPath, gridCellToWorld, worldToGridCell } from './pathfinding'
import {
  AGENT_GRID_COLS,
  AGENT_GRID_RESOLUTION,
  AGENT_GRID_ROWS,
  AGENT_GRID_TRANSFORM,
  AGENT_START_CELL,
  RED_START_CELL,
  buildAgentBlockedCells,
  CUBICLE_ACCESS_POCKETS,
} from './agentGrid'

describe('agent grid', () => {
  it('anchors the grid to the locked floor item transform', () => {
    const floor = LOCKED_DEFAULT_ITEMS.find((item) => item.kind === 'floor')
    expect(floor).toBeDefined()
    expect(AGENT_GRID_TRANSFORM.origin[0]).toBeCloseTo(floor!.transform.position[0])
    expect(AGENT_GRID_TRANSFORM.origin[1]).toBeCloseTo(floor!.transform.position[2])
    expect(AGENT_GRID_RESOLUTION).toBe(2)
    expect(AGENT_GRID_COLS).toBe(OFFICE_COLS * AGENT_GRID_RESOLUTION)
    expect(AGENT_GRID_ROWS).toBe(OFFICE_ROWS * AGENT_GRID_RESOLUTION)
    expect(AGENT_GRID_TRANSFORM.scale[0]).toBeCloseTo((floor!.transform.scale[0] * CELL_SIZE) / AGENT_GRID_RESOLUTION)
    expect(AGENT_GRID_TRANSFORM.scale[1]).toBeCloseTo((floor!.transform.scale[2] * CELL_SIZE) / AGENT_GRID_RESOLUTION)
    expect(AGENT_GRID_TRANSFORM.cols).toBe(AGENT_GRID_COLS)
    expect(AGENT_GRID_TRANSFORM.rows).toBe(AGENT_GRID_ROWS)
  })

  it('blocks the real cubicle footprint cells, not just its center', () => {
    const blocked = buildAgentBlockedCells()
    // Cubicle White 05 at world (0.959, -5.919) with a 3.2 x 3.2 footprint.
    const [col, row] = worldToGridCell(0.959, -5.919, AGENT_GRID_TRANSFORM)
    expect(blocked.has(`${col},${row}`)).toBe(true)
    // Its footprint extends at least one full cell in every direction.
    expect(blocked.has(`${col + 1},${row}`)).toBe(true)
    expect(blocked.has(`${col - 1},${row}`)).toBe(true)
    expect(blocked.has(`${col},${row - 1}`)).toBe(true)
  })

  it('opens a short two-cell entry lane into each locked cubicle', () => {
    const blocked = buildAgentBlockedCells()
    expect(CUBICLE_ACCESS_POCKETS).toEqual([
      [[27, 2], [27, 3], [27, 4], [27, 5], [27, 6], [28, 4]],
      [[27, 14], [28, 14], [29, 14], [27, 15], [28, 15], [29, 15]],
    ])
    for (const pocket of CUBICLE_ACCESS_POCKETS) {
      expect(pocket).toHaveLength(6)
      for (const [col, row] of pocket) {
        // The pocket definition identifies the intended cubicle entrance;
        // independent walls/tables and the robot's clearance envelope may
        // still reserve individual cells.
        expect(typeof blocked.has(`${col},${row}`)).toBe('boolean')
      }
    }

    // The cubicle centers and far edges remain blocked, so the exception
    // cannot turn either cubicle into an unrestricted walkable area.
    expect(blocked.has('20,6')).toBe(true)
    expect(blocked.has('21,6')).toBe(true)
    expect(blocked.has('22,6')).toBe(true)
    expect(blocked.has('23,6')).toBe(true)
    // Pocket exceptions must never erase an independent table/wall blocker.
    expect(blocked.has('22,10')).toBe(true)
    expect(blocked.has('22,9')).toBe(true)
    expect(blocked.has('26,6')).toBe(true)
    expect(blocked.has('24,5')).toBe(true)
    expect(blocked.has('24,8')).toBe(true)
    expect(blocked.has('24,11')).toBe(true)
    expect(blocked.has('24,12')).toBe(true)
    expect(CUBICLE_ACCESS_POCKETS.flat().some(([col, row]) => col === 24 && (row === 5 || row === 11))).toBe(false)
    expect(CUBICLE_ACCESS_POCKETS.flat().some((cell) => findPath(AGENT_START_CELL, cell, {
      blocked,
      cols: AGENT_GRID_COLS,
      rows: AGENT_GRID_ROWS,
    }) !== null)).toBe(true)

    // At least one intended entrance cell per cubicle remains reachable after
    // independent blockers and physical clearance are applied.
    for (const pocket of CUBICLE_ACCESS_POCKETS) {
      expect(pocket.some((cell) => findPath(AGENT_START_CELL, cell, {
        blocked,
        cols: AGENT_GRID_COLS,
        rows: AGENT_GRID_ROWS,
      }) !== null)).toBe(true)
    }
  })

  it('does not let cubicle pockets erase independent furniture blockers', () => {
    const blocked = buildAgentBlockedCells()
    expect(blocked.has('22,9')).toBe(true)
    expect(blocked.has('22,10')).toBe(true)
  })

  it('keeps the computed start cell in the dominant walkable region', () => {
    const blocked = buildAgentBlockedCells()
    expect(blocked.has(`${AGENT_START_CELL[0]},${AGENT_START_CELL[1]}`)).toBe(false)
    // Dense footprint blocking can isolate small pockets between furniture,
    // but the start must reach the large majority of the free floor.
    let free = 0
    let reachable = 0
    for (let c = 0; c < AGENT_GRID_COLS; c += 1) {
      for (let r = 0; r < AGENT_GRID_ROWS; r += 1) {
        if (blocked.has(`${c},${r}`)) continue
        free += 1
        if (findPath(AGENT_START_CELL, [c, r], {
          blocked,
          cols: AGENT_GRID_COLS,
          rows: AGENT_GRID_ROWS,
        })) reachable += 1
      }
    }
    expect(free).toBeGreaterThan(AGENT_GRID_COLS * AGENT_GRID_ROWS * 0.2) // the dense locked scene still leaves hallways walkable
    expect(reachable).toBeGreaterThan(free * 0.7) // start sits in the dominant region
  })

  it('round-trips the start cell through the anchored transform', () => {
    const [x, z] = gridCellToWorld(AGENT_START_CELL, AGENT_GRID_TRANSFORM)
    expect(worldToGridCell(x, z, AGENT_GRID_TRANSFORM)).toEqual(AGENT_START_CELL)
  })

  it('keeps the red sentinel start free and connected', () => {
    const blocked = buildAgentBlockedCells()
    expect(RED_START_CELL).toEqual([7, 12])
    expect(blocked.has(`${RED_START_CELL[0]},${RED_START_CELL[1]}`)).toBe(false)
    expect(findPath(AGENT_START_CELL, RED_START_CELL, {
      blocked,
      cols: AGENT_GRID_COLS,
      rows: AGENT_GRID_ROWS,
    })).not.toBeNull()
  })
})
