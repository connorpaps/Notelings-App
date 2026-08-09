import { describe, expect, it } from 'vitest'
import {
  CATEGORY_TO_DESTINATION,
  CategorizationSchema,
  CategorizeResponseSchema,
  NoteInputSchema,
  NOTE_CONTENT_MAX,
  categoryToDestination,
} from './categorization'

describe('NoteInputSchema', () => {
  it('accepts trimmed content up to 1000 characters', () => {
    expect(NoteInputSchema.parse({ content: '  buy milk  ' }).content).toBe('buy milk')
    expect(NoteInputSchema.parse({ content: 'a'.repeat(NOTE_CONTENT_MAX) })).toBeDefined()
  })
  it('rejects empty and over-length content', () => {
    expect(NoteInputSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(NoteInputSchema.safeParse({ content: 'a'.repeat(NOTE_CONTENT_MAX + 1) }).success).toBe(false)
  })
})

describe('CategorizationSchema', () => {
  it('accepts only the three categories with string tags', () => {
    expect(CategorizationSchema.parse({ category: 'Work', tags: ['idea', 'plan'] })).toBeDefined()
    expect(CategorizationSchema.safeParse({ category: 'Social', tags: [] }).success).toBe(false)
    expect(CategorizationSchema.safeParse({ category: 'Admin', tags: [1] }).success).toBe(false)
  })
})

describe('CategorizeResponseSchema', () => {
  it('parses the route response shape with optional degraded flag', () => {
    expect(CategorizeResponseSchema.parse({ id: 'n1', category: 'Work', tags: ['a'] })).toBeDefined()
    expect(CategorizeResponseSchema.parse({ id: 'n1', category: 'Uncategorized', tags: [], degraded: true }).degraded).toBe(true)
    expect(CategorizeResponseSchema.safeParse({ id: 'n1', category: 'Work', tags: 'nope' }).success).toBe(false)
  })
})

describe('categoryToDestination', () => {
  it('maps Work→whiteboard, Admin→printer, Uncategorized→corkboard', () => {
    expect(CATEGORY_TO_DESTINATION).toEqual({ Work: 'whiteboard', Admin: 'printer', Uncategorized: 'corkboard' })
    expect(categoryToDestination('Work')).toBe('whiteboard')
    expect(categoryToDestination('Admin')).toBe('printer')
    expect(categoryToDestination('Uncategorized')).toBe('corkboard')
  })
})
