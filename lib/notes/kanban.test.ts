import { describe, expect, it } from 'vitest'
import { groupNotesByStatus, KANBAN_COLUMNS, timeAgo } from './kanban'
import type { NoteRecord } from './types'

const note = (id: string, status: NoteRecord['status'], created: string): NoteRecord => ({
  id,
  content: `content ${id}`,
  category: 'Work',
  tags: [],
  status,
  created_at: created,
})

describe('groupNotesByStatus', () => {
  it('splits notes into the three live columns and drops archived', () => {
    const grouped = groupNotesByStatus([
      note('a', 'filed', '2026-08-01T00:00:00Z'),
      note('b', 'pending', '2026-08-02T00:00:00Z'),
      note('c', 'in_transit', '2026-08-03T00:00:00Z'),
      note('d', 'archived', '2026-08-04T00:00:00Z'),
    ])
    expect(grouped.pending.map((n) => n.id)).toEqual(['b'])
    expect(grouped.in_transit.map((n) => n.id)).toEqual(['c'])
    expect(grouped.filed.map((n) => n.id)).toEqual(['a'])
    expect(Object.keys(grouped).sort()).toEqual(['filed', 'in_transit', 'pending'])
  })

  it('orders newest first within each column', () => {
    const grouped = groupNotesByStatus([
      note('old', 'filed', '2026-08-01T00:00:00Z'),
      note('new', 'filed', '2026-08-05T00:00:00Z'),
      note('mid', 'filed', '2026-08-03T00:00:00Z'),
    ])
    expect(grouped.filed.map((n) => n.id)).toEqual(['new', 'mid', 'old'])
  })

  it('exposes the three column definitions', () => {
    expect(KANBAN_COLUMNS.map((c) => c.key)).toEqual(['pending', 'in_transit', 'filed'])
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-08-09T12:00:00Z').getTime()
  it('formats relative times', () => {
    expect(timeAgo(new Date('2026-08-09T11:59:30Z').toISOString(), now)).toBe('just now')
    expect(timeAgo(new Date('2026-08-09T11:55:00Z').toISOString(), now)).toBe('5m ago')
    expect(timeAgo(new Date('2026-08-09T10:00:00Z').toISOString(), now)).toBe('2h ago')
    expect(timeAgo(new Date('2026-08-06T12:00:00Z').toISOString(), now)).toBe('3d ago')
  })
  it('falls back gracefully for invalid dates', () => {
    expect(timeAgo('not-a-date', now)).toBe('')
  })
})
