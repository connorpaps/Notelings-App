import { describe, expect, it } from 'vitest'
import { CELL_SIZE, OFFICE_COLS, OFFICE_ROWS } from './officeLayout'
import { LOCKED_DEFAULT_ITEMS } from './officeBuilderDefault'
import { findFreeCell, findPath, gridCellToWorld, worldToGridCell } from './pathfinding'
import { AGENT_GRID_TRANSFORM, AGENT_START_CELL, buildAgentBlockedCells } from './agentGrid'

describe('agent grid', () => {
  it('anchors the grid to the locked floor item transform', () => {
    const floor = LOCKED_DEFAULT_ITEMS.find((item) => item.kind === 'floor')
    expect(floor).toBeDefined()
    expect(AGENT_GRID_TRANSFORM.origin[0]).toBeCloseTo(floor!.transform.position[0])
    expect(AGENT_GRID_TRANSFORM.origin[1]).toBeCloseTo(floor!.transform.position[2])
    expect(AGENT_GRID_TRANSFORM.scale[0]).toBeCloseTo(floor!.transform.scale[0] * CELL_SIZE)
    expect(AGENT_GRID_TRANSFORM.scale[1]).toBeCloseTo(floor!.transform.scale[2] * CELL_SIZE)
  })

  it('blocks the real cubicle footprint cells, not just its center', () => {
    const blocked = buildAgentBlockedCells()
    // Cubicle White 05 at world (0.959, -5.919) with a 3.2 x 3.2 footprint.
    const [col, row] = worldToGridCell(0.959, -5.919, AGENT_GRID_TRANSFORM)
    expect(blocked.has(`${col},${row}`)).toBe(true)
    // Its footprint extends at least one full cell in every direction.
    expect(blocked.has(`${col + 1},${row}`)).toBe(true)
    expect(blocked.has(`${col - 1},${row}`)).toBe(true)
    expect(blocked.has(`${col},${row + 1}`)).toBe(true)
    expect(blocked.has(`${col},${row - 1}`)).toBe(true)
  })

  it('keeps the computed start cell in the dominant walkable region', () => {
    const blocked = buildAgentBlockedCells()
    expect(blocked.has(`${AGENT_START_CELL[0]},${AGENT_START_CELL[1]}`)).toBe(false)
    // Dense footprint blocking can isolate small pockets between furniture,
    // but the start must reach the large majority of the free floor.
    let free = 0
    let reachable = 0
    for (let c = 0; c < OFFICE_COLS; c += 1) {
      for (let r = 0; r < OFFICE_ROWS; r += 1) {
        if (blocked.has(`${c},${r}`)) continue
        free += 1
        if (findPath(AGENT_START_CELL, [c, r], { blocked })) reachable += 1
      }
    }
    expect(free).toBeGreaterThan(80) // the dense locked scene still leaves hallways walkable
    expect(reachable).toBeGreaterThan(free * 0.7) // start sits in the dominant region
  })

  it('round-trips the start cell through the anchored transform', () => {
    const [x, z] = gridCellToWorld(AGENT_START_CELL, AGENT_GRID_TRANSFORM)
    expect(worldToGridCell(x, z, AGENT_GRID_TRANSFORM)).toEqual(AGENT_START_CELL)
  })
})
