import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_TRANSFORM,
  type GridCell,
  type GridTransform,
} from './navigationGrid'
import {
  createSafePathCurve,
  findFreeCell,
  findOpenStartCell,
  findPath,
  gridCellToWorld,
  isPathSafe,
  worldToGridCell,
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
    for (let i = 1; i < path!.length; i += 1) {
      const [previousCol, previousRow] = path![i - 1]
      const [col, row] = path![i]
      expect(Math.abs(col - previousCol) + Math.abs(row - previousRow)).toBe(1)
    }
  })

  it('returns null when the goal is unreachable', () => {
    expect(findPath([2, 2], [2, 4], {
      blocked: new Set(['1,4', '3,4', '2,3', '2,5']),
    })).toBeNull()
  })

  it('returns the start cell when already at the goal', () => {
    expect(findPath([3, 3], [3, 3], { blocked: none })).toEqual([[3, 3]])
  })

  it('returns null for out-of-bounds, blocked start, and blocked goal', () => {
    expect(findPath([-1, 3], [3, 3], { blocked: none })).toBeNull()
    expect(findPath([3, 3], [DEFAULT_GRID_COLS, 3], { blocked: none })).toBeNull()
    expect(findPath([3, 3], [4, 4], { blocked: new Set(['3,3']) })).toBeNull()
    expect(findPath([3, 3], [4, 4], { blocked: new Set(['4,4']) })).toBeNull()
  })
})

describe('grid transform mapping', () => {
  const anchored: GridTransform = { origin: [-2.3394, -1.4417], scale: [1.14, 0.96], cols: 18, rows: 14 }

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

  it('uses the active GLB grid as the default transform', () => {
    const [x, z] = gridCellToWorld([0, 0], DEFAULT_GRID_TRANSFORM)
    expect(x).toBeCloseTo(-DEFAULT_GRID_COLS * 0.25 / 2)
    expect(z).toBeCloseTo(-DEFAULT_GRID_ROWS * 0.25 / 2)
    expect(worldToGridCell(x, z, DEFAULT_GRID_TRANSFORM)).toEqual([0, 0])
  })
})

describe('path safety and curve helpers', () => {
  it('proves an orthogonal path stays clear of blocked rectangles', () => {
    const transform: GridTransform = { origin: [0, 0], scale: [1, 1], cols: 8, rows: 8 }
    expect(isPathSafe([[1, 1], [1, 2], [2, 2]], transform, new Set(['6,6']), { clearanceWorld: 0.38 })).toBe(true)
    expect(isPathSafe([[1, 1], [1, 2], [2, 2]], transform, new Set(['1,2']), { clearanceWorld: 0.38 })).toBe(false)
  })

  it('creates a collision-safe curve for a free path', () => {
    const transform: GridTransform = { origin: [0, 0], scale: [1, 1], cols: 8, rows: 8 }
    const curve = createSafePathCurve([[1, 1], [1, 2], [2, 2], [3, 2]], transform, none, { clearanceWorld: 0.2 })
    expect(curve).not.toBeNull()
    expect(curve!.getPointAt(0).x).toBeCloseTo(-3)
    expect(curve!.getPointAt(1).z).toBeCloseTo(-2)
  })

  it('uses the robot world position when a path starts between cell centers', () => {
    const transform: GridTransform = { origin: [0, 0], scale: [1, 1], cols: 8, rows: 8 }
    const curve = createSafePathCurve(
      [[1, 1], [1, 2], [2, 2]],
      transform,
      none,
      { clearanceWorld: 0.2, startWorld: [-2.8, -2.4] },
    )
    expect(curve).not.toBeNull()
    expect(curve!.getPointAt(0).toArray()).toEqual([-2.8, 0, -2.4])
  })

  it('rejects a curve that samples a blocked cell or clearance envelope', () => {
    const transform: GridTransform = { origin: [0, 0], scale: [1, 1], cols: 8, rows: 8 }
    expect(createSafePathCurve([[1, 1], [1, 2], [2, 2], [3, 2]], transform, new Set(['2,2']), { clearanceWorld: 0.2 })).toBeNull()
    expect(createSafePathCurve([[1, 1], [1, 2], [2, 2], [3, 2]], transform, new Set(['2,3']), { clearanceWorld: 0.6 })).toBeNull()
  })
})

describe('free-cell helpers', () => {
  it('finds the nearest free cell and returns null when fully blocked', () => {
    expect(findFreeCell([3, 3], new Set(['3,3', '4,3', '2,3', '3,2', '3,4']), { cols: 8, rows: 8 })).toEqual([2, 2])
    const all = new Set<string>()
    for (let col = 0; col < DEFAULT_GRID_COLS; col += 1)
      for (let row = 0; row < DEFAULT_GRID_ROWS; row += 1) all.add(`${col},${row}`)
    expect(findFreeCell([9, 7], all)).toBeNull()
  })

  it('chooses a cell from the largest connected free region', () => {
    const blocked = new Set(['1,0', '1,1', '1,2', '1,3', '1,4'])
    expect(findOpenStartCell([1, 2], blocked, { cols: 4, rows: 5 })).toEqual([2, 1])
  })
})
