import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  PLACEMENTS,
  WALLS,
  BLOCKED_CELLS,
  OFFICE_COLS,
  OFFICE_ROWS,
  cellToWorld,
} from './officeLayout'

const ROOT = join(process.cwd(), 'public') // repo-root public/ (vitest runs from project root)

describe('officeLayout', () => {
  it('has unique ids and non-empty names', () => {
    const ids = PLACEMENTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    PLACEMENTS.forEach((p) => expect(p.name.length).toBeGreaterThan(0))
  })

  it('keeps every placement and wall inside the grid bounds', () => {
    PLACEMENTS.forEach((p) => {
      expect(p.cell[0]).toBeGreaterThanOrEqual(0)
      expect(p.cell[0]).toBeLessThan(OFFICE_COLS)
      expect(p.cell[1]).toBeGreaterThanOrEqual(0)
      expect(p.cell[1]).toBeLessThan(OFFICE_ROWS)
    })
    WALLS.forEach((w) => {
      const end = w.axis === 'x' ? w.cell[0] + w.lenCells : w.cell[1] + w.lenCells
      expect(end).toBeLessThanOrEqual(w.axis === 'x' ? OFFICE_COLS : OFFICE_ROWS)
    })
  })

  it('references only real asset files', () => {
    PLACEMENTS.forEach((p) => {
      expect(existsSync(join(ROOT, p.obj))).toBe(true)
      expect(existsSync(join(ROOT, p.mtl))).toBe(true)
    })
  })

  it('marks every floor-level cell as blocked for pathfinding', () => {
    const floorCells = PLACEMENTS.filter((p) => (p.mount ?? 'floor') === 'floor').map(
      (p) => `${p.cell[0]},${p.cell[1]}`,
    )
    expect(floorCells.length).toBeGreaterThan(0)
    floorCells.forEach((c) => expect(BLOCKED_CELLS.has(c)).toBe(true))
    // BLOCKED_CELLS contains exactly the floor cells — desktop/wall items may
    // share their host's cell but never add new blocked cells.
    expect(BLOCKED_CELLS.size).toBe(new Set(floorCells).size)
  })

  it('maps cells to world coords around the grid center', () => {
    const [x, z] = cellToWorld(0, 0)
    const [cx, cz] = cellToWorld(OFFICE_COLS / 2, OFFICE_ROWS / 2)
    expect(cx).toBeCloseTo(0)
    expect(cz).toBeCloseTo(0)
    expect(x).toBeLessThan(0)
    expect(z).toBeLessThan(0)
  })
})
