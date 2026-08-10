import { describe, expect, it } from 'vitest'
import { buildCitationIndex, invertCitationIndex } from './citations'
import type { NoteRecord } from './types'

const note = (id: string, createdAt: string, status: NoteRecord['status'] = 'filed'): NoteRecord => ({
  id,
  content: `content ${id}`,
  category: 'Work',
  tags: [],
  status,
  created_at: createdAt,
})

describe('buildCitationIndex', () => {
  it('numbers newest-first over non-archived notes', () => {
    const index = buildCitationIndex([
      note('old', '2026-08-01T00:00:00Z'),
      note('new', '2026-08-09T00:00:00Z'),
      note('mid', '2026-08-05T00:00:00Z'),
    ])
    expect([...index.keys()]).toEqual([1, 2, 3])
    expect(index.get(1)?.id).toBe('new')
    expect(index.get(2)?.id).toBe('mid')
    expect(index.get(3)?.id).toBe('old')
  })

  it('breaks ties deterministically by id', () => {
    const index = buildCitationIndex([
      note('b', '2026-08-09T00:00:00Z'),
      note('a', '2026-08-09T00:00:00Z'),
    ])
    expect(index.get(1)?.id).toBe('a')
    expect(index.get(2)?.id).toBe('b')
  })

  it('excludes archived notes and renumbers', () => {
    const index = buildCitationIndex([
      note('arch', '2026-08-09T00:00:00Z', 'archived'),
      note('live', '2026-08-08T00:00:00Z'),
    ])
    expect([...index.values()].map((n) => n.id)).toEqual(['live'])
    expect(index.get(1)?.id).toBe('live')
  })

  it('returns an empty map for no notes', () => {
    expect(buildCitationIndex([]).size).toBe(0)
  })
})

describe('invertCitationIndex', () => {
  it('maps note id → citation number', () => {
    const byId = invertCitationIndex(buildCitationIndex([note('x', '2026-08-09T00:00:00Z')]))
    expect(byId.get('x')).toBe(1)
  })
})
