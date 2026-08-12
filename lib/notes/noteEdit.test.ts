import { describe, expect, it } from 'vitest'
import { EditNoteSchema, parseTags, validateTags } from './noteEdit'

describe('parseTags', () => {
  it('splits commas, trims, drops empties', () => {
    expect(parseTags(' react, finance ,,  x  ')).toEqual(['react', 'finance', 'x'])
  })
  it('returns [] for empty input', () => expect(parseTags('')).toEqual([]))
})

describe('validateTags', () => {
  it('accepts up to 5 tags of up to 40 chars', () =>
    expect(validateTags(['a', 'b', 'c', 'd', 'e'])).toBeNull())
  it('rejects >5 tags', () =>
    expect(validateTags(['a', 'b', 'c', 'd', 'e', 'f'])).toMatch(/at most 5/))
  it('rejects an over-long tag', () =>
    expect(validateTags(['x'.repeat(41)])).toMatch(/40 characters/))
})

describe('EditNoteSchema', () => {
  it('parses a valid payload', () =>
    expect(EditNoteSchema.parse({ content: ' hello ', tags: 'a, b' })).toEqual({
      content: 'hello',
      tags: 'a, b',
    }))
  it('rejects empty content', () =>
    expect(EditNoteSchema.safeParse({ content: '   ', tags: '' }).success).toBe(false))
})
