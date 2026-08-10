import { describe, expect, it } from 'vitest'
import { buildLibrarianSystemPrompt, buildNotesContext, LIBRARIAN_SYSTEM_PROMPT } from './chatContext'
import type { NoteRecord } from './types'

const note = (id: string, content: string, status: NoteRecord['status'] = 'filed'): NoteRecord => ({
  id,
  content,
  category: 'Work',
  tags: ['roadmap'],
  status,
  created_at: '2026-08-01T00:00:00Z',
})

describe('LIBRARIAN_SYSTEM_PROMPT', () => {
  it('contains the exact refusal sentence', () => {
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain("I couldn't find any notes related to that.")
  })

  it('requires strict grounding only in the notes', () => {
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('ONLY in the notes')
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('Do not use outside')
  })

  it('requires bracket-number citations', () => {
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('[1], [2]')
  })

  it('allows grounded partial answers instead of refusing (over-strict fix)', () => {
    // Regression: "when was my business lunch" must answer "Tuesday" from a
    // note that only says "on Tuesday" — refusal is reserved for notes with
    // nothing relevant.
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('even if partial')
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('answer "Tuesday"')
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('Refuse ONLY when the notes contain nothing relevant')
  })

  it('answers placeholder/gibberish notes instead of refusing', () => {
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('placeholder or meaningless')
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('repeated letters')
  })

  it('demands exact counts over estimation', () => {
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('count the matching notes one by one')
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain('never estimate')
  })
})

describe('buildNotesContext', () => {
  it('numbers and renders each active note with category, created time, and tags', () => {
    const context = buildNotesContext([note('1', 'plan the Q3 roadmap'), note('2', 'print contracts', 'pending')])
    expect(context).toContain('[1] (Work, created 2026-08-01 00:00, tags: roadmap) plan the Q3 roadmap')
    expect(context).toContain('[2] (Work, created 2026-08-01 00:00, tags: roadmap) print contracts')
  })

  it('exposes created_at so the model can answer "when did I create that note?"', () => {
    // Regression: created_at is fetched by the route but was NOT included in
    // the context, so follow-ups about note metadata were unanswerable.
    const context = buildNotesContext([note('1', 'reminder to buy groceries')])
    expect(context).toContain('created 2026-08-01 00:00')
  })

  it('excludes archived notes', () => {
    const context = buildNotesContext([note('1', 'secret', 'archived')])
    expect(context).not.toContain('secret')
    expect(context).toContain('(no notes)')
  })

  it('renders an empty block for no notes', () => {
    expect(buildNotesContext([])).toBe('<notes>\n(no notes)\n</notes>')
  })
})

describe('buildLibrarianSystemPrompt', () => {
  it('combines the rule block with the notes block', () => {
    const prompt = buildLibrarianSystemPrompt([note('1', 'hello')])
    expect(prompt).toContain(LIBRARIAN_SYSTEM_PROMPT)
    expect(prompt).toContain('<notes>')
    expect(prompt).toContain('hello')
  })
})
