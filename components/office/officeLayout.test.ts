import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  PLACEMENTS,
  WALLS,
  CAMERA_FACING_WALL_IDS,
  BLOCKED_CELLS,
  OFFICE_COLS,
  OFFICE_ROWS,
  cellToWorld,
} from './officeLayout'

const ROOT = join(process.cwd(), 'public')

describe('officeLayout', () => {
  it('has unique ids and non-empty names', () => {
    const ids = PLACEMENTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    PLACEMENTS.forEach((p) => expect(p.name.length).toBeGreaterThan(0))
  })

  it('keeps the camera-facing wall runs open for the dollhouse view', () => {
    expect(WALLS.map((w) => w.id)).toEqual([
      'wall-negative-z',
      'wall-left-upper',
      'wall-left-lower',
    ])
    expect(CAMERA_FACING_WALL_IDS).toEqual(['wall-positive-z', 'wall-positive-x'])
    expect(WALLS.some((w) => w.axis === 'x' && w.cell[1] === OFFICE_ROWS - 1)).toBe(false)
    expect(WALLS.some((w) => w.axis === 'z' && w.cell[0] === OFFICE_COLS - 1)).toBe(false)
  })

  it('keeps every placement and wall inside the grid bounds', () => {
    PLACEMENTS.forEach((p) => {
      expect(p.cell[0]).toBeGreaterThanOrEqual(0)
      expect(p.cell[0]).toBeLessThan(OFFICE_COLS)
      expect(p.cell[1]).toBeGreaterThanOrEqual(0)
      expect(p.cell[1]).toBeLessThan(OFFICE_ROWS)
    })
    WALLS.forEach((w) => {
      expect(w.id.length).toBeGreaterThan(0)
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

  it('keeps the reference lounge and filing cabinet contract', () => {
    const byId = new Map(PLACEMENTS.map((p) => [p.id, p]))
    expect(PLACEMENTS.filter((p) => p.id === 'tv-wall')).toHaveLength(1)
    expect(PLACEMENTS.filter((p) => p.id === 'tv-console')).toHaveLength(1)
    expect(byId.get('tv-wall')?.mount).toBe('wall')
    expect(byId.get('tv-console')?.mount ?? 'floor').toBe('floor')
    expect(byId.get('couch-white')?.rotationY).toBeCloseTo(Math.PI / 2)
    expect(byId.get('couch-black')?.rotationY).toBeCloseTo(-Math.PI / 2)
    expect(byId.get('tv-wall')?.wallSide).toBe('left')
    expect(byId.get('tv-wall')?.cell).toEqual([0, 4])
    expect(byId.get('tv-wall')?.wallOffset).toBeCloseTo(0.325)
    expect(byId.get('tv-console')?.cell).toEqual([0, 4])
    expect(byId.get('tv-console')?.wallOffset).toBeCloseTo(-0.175)
    expect(byId.get('cabinet-1')?.cell[0]).toBe(16)
    expect(byId.get('cabinet-2')?.cell[0]).toBe(16)
  })

  it('marks every floor-level cell as blocked for pathfinding', () => {
    const floorCells = PLACEMENTS.filter((p) => (p.mount ?? 'floor') === 'floor').map(
      (p) => `${p.cell[0]},${p.cell[1]}`,
    )
    expect(floorCells.length).toBeGreaterThan(0)
    floorCells.forEach((c) => expect(BLOCKED_CELLS.has(c)).toBe(true))
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
