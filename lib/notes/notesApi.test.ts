import { describe, expect, it } from 'vitest'
import { NotePatchSchema, NoteRecordSchema, NoteStatusSchema } from './notesApi'

describe('NotePatchSchema', () => {
  it('rejects an empty patch (nothing to update)', () => {
    expect(NotePatchSchema.safeParse({}).success).toBe(false)
  })

  it('accepts content-only, tags-only, and status-only patches', () => {
    expect(NotePatchSchema.parse({ content: '  hello  ' }).content).toBe('hello')
    expect(NotePatchSchema.parse({ tags: ['a', 'b'] }).tags).toEqual(['a', 'b'])
    expect(NotePatchSchema.parse({ status: 'in_transit' }).status).toBe('in_transit')
  })

  it('accepts clearing ALL tags (a valid manual tag state)', () => {
    expect(NotePatchSchema.parse({ tags: [] }).tags).toEqual([])
  })

  it('rejects invalid content, tags, and status values', () => {
    expect(NotePatchSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(NotePatchSchema.safeParse({ content: 'a'.repeat(1001) }).success).toBe(false)
    expect(NotePatchSchema.safeParse({ tags: [''] }).success).toBe(false)
    expect(NotePatchSchema.safeParse({ tags: ['a'.repeat(41)] }).success).toBe(false)
    expect(NotePatchSchema.safeParse({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false)
    expect(NotePatchSchema.safeParse({ status: 'bogus' }).success).toBe(false)
  })
})

describe('NoteStatusSchema', () => {
  it('allows exactly the four lifecycle statuses', () => {
    for (const status of ['pending', 'in_transit', 'filed', 'archived']) {
      expect(NoteStatusSchema.parse(status)).toBe(status)
    }
    expect(NoteStatusSchema.safeParse('categorized').success).toBe(false)
  })
})

describe('NoteRecordSchema', () => {
  it('parses a full row with optional updated_at', () => {
    const row = {
      id: 'n1',
      content: 'hi',
      category: 'Work',
      tags: ['a'],
      status: 'filed',
      created_at: '2026-08-09T00:00:00Z',
      updated_at: '2026-08-09T01:00:00Z',
    }
    expect(NoteRecordSchema.parse(row).status).toBe('filed')
    expect(NoteRecordSchema.parse({ ...row, updated_at: null }).updated_at).toBeNull()
    expect(NoteRecordSchema.safeParse({ ...row, status: 'nope' }).success).toBe(false)
  })
})
