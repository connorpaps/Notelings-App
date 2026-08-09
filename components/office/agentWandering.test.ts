import { describe, expect, it } from 'vitest'
import { pickWanderCell } from './agentWandering'

describe('agent wandering', () => {
  it('rejects the current and blocked cells, then accepts a reachable random cell', () => {
    const cell = pickWanderCell([1, 1], new Set(['0,0', '1,0']), {
      cols: 3,
      rows: 3,
      random: () => 0.8,
    })
    expect(cell).toEqual([2, 2])
  })

  it('falls back deterministically when random samples are invalid', () => {
    expect(
      pickWanderCell([0, 0], new Set(['0,1']), {
        cols: 2,
        rows: 2,
        random: () => 0,
        attempts: 2,
      }),
    ).toEqual([1, 0])
  })

  it('returns null when no alternative free cell exists', () => {
    expect(pickWanderCell([0, 0], new Set(['1,0', '0,1']), { cols: 2, rows: 2 })).toBeNull()
  })
})
