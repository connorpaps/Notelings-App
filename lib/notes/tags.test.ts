import { describe, expect, it } from 'vitest'
import { collectUniqueTags, notesWithTag, tagCounts } from './tags'
import type { NoteRecord } from './types'

const base = (id: string, tags: string[], status: NoteRecord['status']): NoteRecord => ({
  id,
  content: `note ${id}`,
  category: 'Work',
  tags,
  status,
  created_at: '2026-08-01T00:00:00Z',
})

const fixtures: NoteRecord[] = [
  base('1', ['roadmap', 'Q3'], 'filed'),
  base('2', ['roadmap', 'budget'], 'in_transit'),
  base('3', ['ROADMAP'], 'archived'),
  base('4', [], 'pending'),
]

describe('collectUniqueTags', () => {
  it('dedupes case-insensitively (first casing wins) and sorts', () => {
    expect(collectUniqueTags(fixtures)).toEqual(['budget', 'Q3', 'roadmap'])
  })

  it('ignores archived notes', () => {
    // Without note 3's ROADMAP the dedupe casing is still 'roadmap' from note 1.
    expect(collectUniqueTags([base('3', ['ROADMAP'], 'archived')])).toEqual([])
  })

  it('returns [] for empty input', () => {
    expect(collectUniqueTags([])).toEqual([])
  })
})

describe('notesWithTag', () => {
  it('matches case-insensitively and excludes archived notes', () => {
    const ids = notesWithTag(fixtures, 'ROADMAP').map((note) => note.id)
    expect(ids).toEqual(['1', '2'])
  })

  it('returns [] when no note has the tag', () => {
    expect(notesWithTag(fixtures, 'nope')).toEqual([])
  })
})

describe('tagCounts', () => {
  it('counts per normalized tag over non-archived notes', () => {
    const counts = tagCounts(fixtures)
    expect(counts.get('roadmap')).toBe(2)
    expect(counts.get('budget')).toBe(1)
    expect(counts.get('q3')).toBe(1)
    expect(counts.has('ROADMAP')).toBe(false)
  })

  it('returns an empty map for empty input', () => {
    expect(tagCounts([]).size).toBe(0)
  })
})
