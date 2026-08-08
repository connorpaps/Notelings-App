import { describe, expect, it } from 'vitest'
import { CELL_SIZE, OFFICE_COLS, OFFICE_ROWS } from './officeLayout'
import {
  buildEffectiveBlockedCells,
  DEFAULT_GRID_TRANSFORM,
  findFreeCell,
  findPath,
  gridCellToWorld,
  worldToGridCell,
  type GridCell,
  type GridTransform,
} from './pathfinding'

const none: ReadonlySet<string> = new Set()

describe('findPath', () => {
  it('returns a straight orthogonal path', () => {
    const path = findPath([2, 4], [2, 8], { blocked: none })
    expect(path?.map(([c, r]) => `${c},${r}`)).toEqual(['2,4', '2,5', '2,6', '2,7', '2,8'])
  })

  it('routes around a blocked cell', () => {
    const path = findPath([4, 5], [6, 5], { blocked: new Set(['5,5']) })
    expect(path).not.toBeNull()
    expect(path![0]).toEqual([4, 5])
    expect(path![path!.length - 1]).toEqual([6, 5])
    expect(path!.every(([c, r]) => !(c === 5 && r === 5))).toBe(true)
    // Orthogonal steps only: each consecutive pair differs by exactly 1 in one axis
    for (let i = 1; i < path!.length; i += 1) {
      const [pc, pr] = path![i - 1]
      const [c, r] = path![i]
      expect(Math.abs(c - pc) + Math.abs(r - pr)).toBe(1)
    }
  })

  it('returns null when the goal is unreachable', () => {
    const path = findPath([2, 2], [2, 4], {
      blocked: new Set(['1,4', '3,4', '2,3', '2,5']),
    })
    expect(path).toBeNull()
  })

  it('returns the start cell when already at the goal', () => {
    expect(findPath([3, 3], [3, 3], { blocked: none })).toEqual([[3, 3]])
  })

  it('returns null for out-of-bounds, blocked start, and blocked goal', () => {
    expect(findPath([-1, 3], [3, 3], { blocked: none })).toBeNull()
    expect(findPath([3, 3], [OFFICE_COLS, 3], { blocked: none })).toBeNull()
    expect(findPath([3, 3], [4, 4], { blocked: new Set(['3,3']) })).toBeNull()
    expect(findPath([3, 3], [4, 4], { blocked: new Set(['4,4']) })).toBeNull()
  })
})

describe('grid transform mapping', () => {
  const anchored: GridTransform = { origin: [-2.3394, -1.4417], scale: [1.14, 0.96] }

  it('round-trips cells through gridCellToWorld/worldToGridCell', () => {
    for (const cell of [[0, 0], [9, 7], [17, 13], [3, 6]] as GridCell[]) {
      const [x, z] = gridCellToWorld(cell, anchored)
      expect(worldToGridCell(x, z, anchored)).toEqual(cell)
    }
  })

  it('anchors the center cell at the transform origin', () => {
    const [x, z] = gridCellToWorld([9, 7], anchored)
    expect(x).toBeCloseTo(anchored.origin[0])
    expect(z).toBeCloseTo(anchored.origin[1])
  })

  it('matches the default transform to the legacy centered mapping', () => {
    const [x, z] = gridCellToWorld([0, 0], DEFAULT_GRID_TRANSFORM)
    expect(x).toBeCloseTo((0 - OFFICE_COLS / 2) * CELL_SIZE)
    expect(z).toBeCloseTo((0 - OFFICE_ROWS / 2) * CELL_SIZE)
    expect(worldToGridCell(x, z, DEFAULT_GRID_TRANSFORM)).toEqual([0, 0])
  })
})

describe('buildEffectiveBlockedCells', () => {
  it('keeps the base set and adds walls plus floor-level models', () => {
    const items = [
      { kind: 'wall', transform: { position: [-12, 1.7, -7] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] } },
      { kind: 'model', obj: '/models/x.obj', transform: { position: [0.9, 0, -5.9] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] } },
      { kind: 'model', obj: '/models/y.obj', transform: { position: [0.9, 1.1, 2.5] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] } }, // elevated → skipped
      { kind: 'floor', transform: { position: [-2.3, 0, -1.4] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] } }, // skipped
    ]
    const blocked = buildEffectiveBlockedCells(items, { base: new Set(['0,0']) })
    expect(blocked.has('0,0')).toBe(true) // base preserved
    expect(blocked.has('0,1')).toBe(true) // wall (default 1-cell footprint) clamped to border column 0
    expect(blocked.has('10,2')).toBe(true) // model at (0.9, -5.9) with default 1-cell footprint
    expect(blocked.has('9,9')).toBe(false) // elevated model skipped
    expect(blocked.has('8,7')).toBe(false) // floor item skipped
  })

  it('clamps out-of-grid furniture to the border', () => {
    const blocked = buildEffectiveBlockedCells([
      { kind: 'model', obj: '/models/far.obj', transform: { position: [-40, 0, 40] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] } },
    ])
    expect(blocked.has('0,13')).toBe(true) // clamped to row OFFICE_ROWS - 1
  })

  it('blocks every cell under a real footprint, not just the center', () => {
    const transform: GridTransform = { origin: [-2.3394, -1.4417], scale: [1.14, 0.96] }
    // 3.2 x 1.2 table centered at world (-4.62, -2.40) → grid cell [7, 6]
    const blocked = buildEffectiveBlockedCells(
      [
        {
          kind: 'model',
          obj: '/models/table.obj',
          transform: { position: [-4.62, 0, -2.4] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
        },
      ],
      { transform, footprints: { '/models/table.obj': { width: 3.2, depth: 1.2 } } },
    )
    expect(blocked.has('7,6')).toBe(true) // center cell
    expect(blocked.has('6,6')).toBe(true) // footprint left half
    expect(blocked.has('8,6')).toBe(true) // footprint right half
    expect(blocked.has('7,5')).toBe(true) // footprint front half
    expect(blocked.has('2,2')).toBe(false) // far hallway stays free
  })

  it('swaps the footprint when an item is rotated 90 degrees around Y', () => {
    const transform: GridTransform = { origin: [0, 0], scale: [CELL_SIZE, CELL_SIZE] }
    // 2.4 wide x 1.2 deep table rotated 90° → 1.2 wide x 2.4 deep, centered at cell [5, 5]
    const blocked = buildEffectiveBlockedCells(
      [
        {
          kind: 'model',
          obj: '/models/table.obj',
          transform: { position: [(5 - 9) * CELL_SIZE, 0, (5 - 7) * CELL_SIZE] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
        },
      ],
      { transform, footprints: { '/models/table.obj': { width: 2.4, depth: 1.2 } } },
    )
    expect(blocked.has('5,5')).toBe(true)
    expect(blocked.has('5,4')).toBe(true) // rotated footprint now spans rows
    expect(blocked.has('5,6')).toBe(true)
    expect(blocked.has('4,5')).toBe(false) // no longer spans the unrotated columns
  })

  it('blocks wall segments by their wall footprint', () => {
    const transform: GridTransform = { origin: [0, 0], scale: [CELL_SIZE, CELL_SIZE] }
    // x-axis wall of 4 cells (4.8 long, 0.25 thick) centered at cell [5, 2]
    const blocked = buildEffectiveBlockedCells(
      [
        {
          kind: 'wall',
          wall: { axis: 'x', lenCells: 4, thickness: 0.25 },
          transform: { position: [(5 - 9) * CELL_SIZE, 1.7, (2 - 7) * CELL_SIZE] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
        },
      ],
      { transform },
    )
    expect(blocked.has('5,2')).toBe(true)
    expect(blocked.has('4,2')).toBe(true)
    expect(blocked.has('6,2')).toBe(true)
    expect(blocked.has('7,2')).toBe(true)
  })
})

describe('findFreeCell', () => {
  it('finds the nearest free in-bounds cell and returns null when fully blocked', () => {
    // Ring scan visits dc=-1,dr=-1 first, so [2,2] is the deterministic pick.
    expect(findFreeCell([3, 3], new Set(['3,3', '4,3', '2,3', '3,2', '3,4']))).toEqual([2, 2])
    const all = new Set<string>()
    for (let c = 0; c < OFFICE_COLS; c += 1)
      for (let r = 0; r < OFFICE_ROWS; r += 1) all.add(`${c},${r}`)
    expect(findFreeCell([9, 7], all)).toBeNull()
  })
})
