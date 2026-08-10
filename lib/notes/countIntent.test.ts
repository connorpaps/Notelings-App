import { describe, expect, it } from 'vitest'
import { countNotesMatching, detectCountQuery, noteMatchesTopic } from './countIntent'
import type { NoteRecord } from './types'

const note = (
  id: string,
  content: string,
  category: NoteRecord['category'] = 'Work',
  tags: string[] = [],
  status: NoteRecord['status'] = 'filed',
): NoteRecord => ({
  id,
  content,
  category,
  tags,
  status,
  created_at: '2026-08-01T00:00:00Z',
})

describe('detectCountQuery', () => {
  it('detects common phrasings and extracts the topic', () => {
    expect(detectCountQuery('how many notes mention testing?')).toBe('testing')
    expect(detectCountQuery('how many of my notes are about groceries')).toBe('groceries')
    expect(detectCountQuery('how many work notes do I have?')).toBe('work')
    expect(detectCountQuery('count my notes tagged urgent')).toBe('urgent')
    expect(detectCountQuery('How many notes contain receipts?')).toBe('receipts')
    expect(detectCountQuery('count the notes about testing')).toBe('testing')
    expect(detectCountQuery('how many of my notes are about the business lunch')).toBe('business lunch')
  })

  it('returns null for non-count questions', () => {
    expect(detectCountQuery('what is the capital of France?')).toBeNull()
    expect(detectCountQuery('summarize my notes')).toBeNull()
  })

  it('returns null when no topic can be extracted', () => {
    expect(detectCountQuery('how many notes do I have?')).toBeNull()
    expect(detectCountQuery('how many notes')).toBeNull()
  })
})

describe('noteMatchesTopic', () => {
  it('matches content, tags, and category case-insensitively', () => {
    expect(noteMatchesTopic(note('1', 'buy groceries tomorrow'), 'groceries')).toBe(true)
    expect(noteMatchesTopic(note('2', 'reminder', 'Admin', ['receipts']), 'RECEIPTS')).toBe(true)
    expect(noteMatchesTopic(note('3', 'reminder', 'Admin', ['receipts']), 'admin')).toBe(true)
    expect(noteMatchesTopic(note('4', 'reminder', 'Admin', ['receipts']), 'roadmap')).toBe(false)
  })

  it('matches word stems (test matches testing / test note)', () => {
    expect(noteMatchesTopic(note('5', 'a testing note'), 'test')).toBe(true)
    expect(noteMatchesTopic(note('6', 'a test note'), 'testing')).toBe(true)
  })
})

describe('countNotesMatching', () => {
  const notes = [
    note('1', 'testing one', 'Admin'),
    note('2', 'plan the Q3 roadmap', 'Work'),
    note('3', 'test note two', 'Work', ['test']),
    note('4', 'roadmap retro', 'Work', [], 'archived'),
  ]

  it('counts deterministically and excludes archived notes', () => {
    const matches = countNotesMatching(notes, 'test')
    expect(matches.map((n) => n.id)).toEqual(['1', '3'])
  })

  it('counts by category too', () => {
    expect(countNotesMatching(notes, 'work').map((n) => n.id)).toEqual(['2', '3'])
  })
})
