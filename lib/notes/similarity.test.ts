import { describe, expect, it } from 'vitest'
import { cosineSimilarity, rankByEmbeddings } from './similarity'
import type { NoteRecord } from './types'

const note = (id: string, createdAt: string): NoteRecord => ({
  id,
  content: `content ${id}`,
  category: 'Work',
  tags: [],
  status: 'filed',
  created_at: createdAt,
})

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors and ~0 for orthogonal ones', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 10)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10)
  })

  it('handles mismatched or empty vectors', () => {
    expect(cosineSimilarity([1], [1, 2])).toBe(0)
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
  })
})

describe('rankByEmbeddings', () => {
  const notes = [note('a', '2026-08-01T00:00:00Z'), note('b', '2026-08-02T00:00:00Z'), note('c', '2026-08-03T00:00:00Z')]

  it('ranks by similarity and takes the top K', () => {
    // Query vector closest to note b's vector.
    const ranked = rankByEmbeddings(notes, [0, 1, 0], [[1, 0, 0], [0, 1, 0], [0, 0.5, 0.5]], 2)
    expect(ranked.map(({ note }) => note.id)).toEqual(['b', 'c'])
  })

  it('breaks ties by newest created_at', () => {
    const ranked = rankByEmbeddings(notes, [1, 0, 0], [[1, 0, 0], [1, 0, 0], [0, 0, 1]], 2)
    expect(ranked[0].note.id).toBe('b') // both a and b score 1; b is newer
  })

  it('excludes archived notes', () => {
    const archived = { ...notes[0], status: 'archived' as const }
    const ranked = rankByEmbeddings([archived, notes[1]], [1, 0], [[1, 0], [1, 0]], 5)
    expect(ranked.map(({ note }) => note.id)).toEqual(['b'])
  })
})
