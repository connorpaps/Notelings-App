import { describe, expect, it } from 'vitest'
import { NEW_OFFICE_AGENT_START_CELLS, NEW_OFFICE_EFFECTIVE_BLOCKED, NEW_OFFICE_RED_START_CELL } from './newOfficeGrid'
import { NEW_OFFICE_GRID_TRANSFORM } from './newOfficeLayout'
import { TASK_DESTINATIONS, TRASH_STAGING_CELL } from './agentDestinations'
import {
  applyEdits,
  buildLockPayload,
  cellKeyAtWorld,
  collectWalkableCells,
  paintEdit,
  sortCellKeys,
} from './gridEditor'

describe('gridEditor walkable collection', () => {
  const cells = collectWalkableCells(NEW_OFFICE_EFFECTIVE_BLOCKED, NEW_OFFICE_GRID_TRANSFORM)
  const cellSet = new Set(cells)

  it('paints exactly the 572 currently-free cells (none clipped by the floor)', () => {
    expect(cells.length).toBe(572)
    expect(cells.every((key) => !NEW_OFFICE_EFFECTIVE_BLOCKED.has(key))).toBe(true)
  })

  it('never paints a cell off the floor footprint', () => {
    for (const key of cells) {
      const [col, row] = key.split(',').map(Number)
      const [x, z] = [(col - 21) * 0.25, (row - 21) * 0.25]
      expect(x).toBeGreaterThanOrEqual(-5.04)
      expect(x).toBeLessThanOrEqual(5.0163)
      expect(z).toBeGreaterThanOrEqual(-5.0617)
      expect(z).toBeLessThanOrEqual(5.0514)
    }
  })

  it('includes every robot destination staging cell and start cell', () => {
    // The four real delivery destinations + all robot spawns must be walkable.
    // (Door anchors like bigEntrance are NOT robot destinations.)
    const expected = [
      ...Object.values(TASK_DESTINATIONS),
      TRASH_STAGING_CELL,
      ...Object.values(NEW_OFFICE_AGENT_START_CELLS),
      NEW_OFFICE_RED_START_CELL,
    ]
    for (const [col, row] of expected) {
      expect(cellSet.has(`${col},${row}`), `walkable cell (${col}, ${row})`).toBe(true)
    }
  })
})

describe('gridEditor edit deltas', () => {
  it('applyEdits adds blocked edits and removes free edits', () => {
    const merged = applyEdits(NEW_OFFICE_EFFECTIVE_BLOCKED, { '22,37': 'blocked', '9,5': 'free' })
    expect(merged.has('22,37')).toBe(true)
    expect(merged.has('9,5')).toBe(false)
    // Untouched cells keep the baked state: 0,0 is wall, 30,4 is the green
    // robot's start (guaranteed free by the grid invariants).
    expect(merged.has('0,0')).toBe(true)
    expect(merged.has('30,4')).toBe(false)
  })

  it('paintEdit stores an override only when it differs from the baked map', () => {
    // 22,37 is baked-free → blocking it stores an edit.
    expect(NEW_OFFICE_EFFECTIVE_BLOCKED.has('22,37')).toBe(false)
    const blockedEdit = paintEdit(NEW_OFFICE_EFFECTIVE_BLOCKED, {}, '22,37', false)
    expect(blockedEdit).toEqual({ '22,37': 'blocked' })
    // Painting it back to free reverts to no edit.
    expect(paintEdit(NEW_OFFICE_EFFECTIVE_BLOCKED, blockedEdit, '22,37', true)).toEqual({})
    // 0,0 is baked-blocked → freeing it stores an edit; re-blocking reverts.
    expect(paintEdit(NEW_OFFICE_EFFECTIVE_BLOCKED, {}, '0,0', true)).toEqual({ '0,0': 'free' })
    expect(paintEdit(NEW_OFFICE_EFFECTIVE_BLOCKED, { '0,0': 'free' }, '0,0', false)).toEqual({})
  })

})

describe('gridEditor world mapping', () => {
  it('maps world points to on-floor cells', () => {
    expect(cellKeyAtWorld(0, 0, NEW_OFFICE_GRID_TRANSFORM)).toBe('21,21')
    expect(cellKeyAtWorld(5.0, -5.0, NEW_OFFICE_GRID_TRANSFORM)).toBe('41,1')
  })

  it('rejects off-grid and off-floor points', () => {
    expect(cellKeyAtWorld(6, 0, NEW_OFFICE_GRID_TRANSFORM)).toBeNull()
    expect(cellKeyAtWorld(-5.3, 0, NEW_OFFICE_GRID_TRANSFORM)).toBeNull()
    expect(cellKeyAtWorld(-5.3, -5.3, NEW_OFFICE_GRID_TRANSFORM)).toBeNull()
  })
})

describe('gridEditor lock payload', () => {
  it('builds the JSON the lock-in script consumes', () => {
    const payload = JSON.parse(buildLockPayload(NEW_OFFICE_EFFECTIVE_BLOCKED, NEW_OFFICE_GRID_TRANSFORM)) as {
      grid: { cols: number; rows: number; cellSize: number }
      blocked: string[]
      source: string
    }
    expect(payload.grid).toEqual({ cols: 42, rows: 42, cellSize: 0.25 })
    expect(payload.source).toBe('notelings-grid-editor')
    expect(payload.blocked.length).toBe(NEW_OFFICE_EFFECTIVE_BLOCKED.size)
    expect(payload.blocked).toEqual(sortCellKeys(NEW_OFFICE_EFFECTIVE_BLOCKED))
  })
})
