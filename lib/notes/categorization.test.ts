import { describe, expect, it } from 'vitest'
import {
  CATEGORY_TO_DESTINATION,
  CategorizationSchema,
  CategorizeResponseSchema,
  ManualNoteInputSchema,
  NoteInputSchema,
  NOTE_CONTENT_MAX,
  categoryToDestination,
} from './categorization'

describe('NoteInputSchema', () => {
  it('accepts trimmed content up to 1000 characters', () => {
    expect(NoteInputSchema.parse({ content: '  buy milk  ' }).content).toBe('buy milk')
    expect(NoteInputSchema.parse({ content: 'a'.repeat(NOTE_CONTENT_MAX) })).toBeDefined()
    expect(NoteInputSchema.parse({ content: 'x', submission_id: '00000000-0000-4000-8000-000000000001' }).submission_id).toBe(
      '00000000-0000-4000-8000-000000000001',
    )
  })
  it('rejects empty and over-length content', () => {
    expect(NoteInputSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(NoteInputSchema.safeParse({ content: 'a'.repeat(NOTE_CONTENT_MAX + 1) }).success).toBe(false)
  })
})

describe('ManualNoteInputSchema', () => {
  it('accepts optional tags without a user-selected category', () => {
    expect(ManualNoteInputSchema.parse({ content: 'buy groceries', tags: ['Grocery'] })).toEqual({
      content: 'buy groceries',
      tags: ['Grocery'],
    })
    expect(ManualNoteInputSchema.parse({ content: 'remember milk' }).tags).toEqual([])
  })

  it('rejects a client-supplied category and overlong tag lists', () => {
    expect(ManualNoteInputSchema.safeParse({ content: 'x', category: 'Work', tags: [] }).success).toBe(false)
    expect(ManualNoteInputSchema.safeParse({ content: 'x', tags: ['1', '2', '3', '4', '5', '6'] }).success).toBe(false)
  })
})

describe('CategorizationSchema', () => {
  it('accepts only the three categories with string tags', () => {
    expect(CategorizationSchema.parse({ category: 'Work', tags: ['idea', 'plan'] })).toBeDefined()
    expect(CategorizationSchema.safeParse({ category: 'Manual', tags: [] }).success).toBe(false)
    expect(CategorizationSchema.safeParse({ category: 'Admin', tags: [1] }).success).toBe(false)
  })
})

describe('CategorizeResponseSchema', () => {
  it('parses the route response shape with optional degraded flag', () => {
    expect(CategorizeResponseSchema.parse({ id: 'n1', category: 'Work', tags: ['a'] })).toBeDefined()
    expect(CategorizeResponseSchema.parse({ id: 'n1', category: 'Uncategorized', tags: [], degraded: true }).degraded).toBe(true)
    expect(CategorizeResponseSchema.parse({ id: 'n1', category: 'Manual', tags: [] }).category).toBe('Manual')
    expect(CategorizeResponseSchema.safeParse({ id: 'n1', category: 'Work', tags: 'nope' }).success).toBe(false)
  })
})

describe('categoryToDestination', () => {
  it('maps Work→whiteboard, Admin→printer, Uncategorized/Manual→corkboard', () => {
    expect(CATEGORY_TO_DESTINATION).toEqual({
      Work: 'whiteboard',
      Admin: 'printer',
      Uncategorized: 'corkboard',
      Manual: 'corkboard',
    })
    expect(categoryToDestination('Work')).toBe('whiteboard')
    expect(categoryToDestination('Admin')).toBe('printer')
    expect(categoryToDestination('Uncategorized')).toBe('corkboard')
    expect(categoryToDestination('Manual')).toBe('corkboard')
  })
})
