import { describe, expect, it } from 'vitest'
import { OFFICE_COLS, OFFICE_ROWS } from './officeLayout'
import { buildEffectiveBlockedCells, findFreeCell, findPath, type GridCell } from './pathfinding'

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

describe('buildEffectiveBlockedCells', () => {
  it('keeps the base set and adds walls plus floor-level models', () => {
    const items = [
      { kind: 'wall', transform: { position: [-12, 1.7, -7] as [number, number, number] } },
      { kind: 'model', transform: { position: [0.9, 0, -5.9] as [number, number, number] } },
      { kind: 'model', transform: { position: [0.9, 1.1, 2.5] as [number, number, number] } }, // elevated → skipped
      { kind: 'floor', transform: { position: [-2.3, 0, -1.4] as [number, number, number] } }, // skipped
    ]
    const blocked = buildEffectiveBlockedCells(items, new Set(['0,0']))
    expect(blocked.has('0,0')).toBe(true) // base preserved
    expect(blocked.has('0,1')).toBe(true) // wall at (-12, -7) clamped to border column 0
    expect(blocked.has('10,2')).toBe(true) // model at (0.9, -5.9)
    expect(blocked.has('9,9')).toBe(false) // elevated model skipped
    expect(blocked.has('8,7')).toBe(false) // floor item skipped
  })

  it('clamps out-of-grid furniture to the border', () => {
    const blocked = buildEffectiveBlockedCells([
      { kind: 'model', transform: { position: [-40, 0, 40] as [number, number, number] } },
    ])
    expect(blocked.has('0,13')).toBe(true) // clamped to row OFFICE_ROWS - 1
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
