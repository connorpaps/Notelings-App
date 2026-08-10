import { describe, expect, it } from 'vitest'
import { buildLibrarianSystemPrompt, buildNotesContext, LIBRARIAN_SYSTEM_PROMPT } from './chatContext'
import { buildCitationIndex, invertCitationIndex } from './citations'
import type { NoteRecord } from './types'

const note = (id: string, content: string, status: NoteRecord['status'] = 'filed'): NoteRecord => ({
  id,
  content,
  category: 'Work',
  tags: ['roadmap'],
  status,
  created_at: '2026-08-01T00:00:00Z',
})

/** Global numbering for fixtures — same as the route builds it. */
function numberById(notes: NoteRecord[]): Map<string, number> {
  return invertCitationIndex(buildCitationIndex(notes))
}

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
  it('labels each active note with its global citation number, created time, and tags', () => {
    const notes = [note('1', 'plan the Q3 roadmap'), note('2', 'print contracts', 'pending')]
    const context = buildNotesContext(notes, numberById(notes))
    expect(context).toContain('[1] (Work, created 2026-08-01 00:00, tags: roadmap) plan the Q3 roadmap')
    expect(context).toContain('[2] (Work, created 2026-08-01 00:00, tags: roadmap) print contracts')
  })

  it('keeps global numbers even for a reordered subset (embedding retrieval)', () => {
    // Simulate retrieval: a subset presented out of global order must still
    // carry its GLOBAL numbers so client-side citation resolution works.
    const all = [note('a', 'aaa', 'filed'), note('b', 'bbb', 'filed'), note('c', 'ccc', 'filed')]
    // Global order: newest first — all share created_at, so id asc: a=1, b=2, c=3.
    const subset = [all[2], all[0]] // presented as [c, a]
    const context = buildNotesContext(subset, numberById(all))
    expect(context).toContain('[3] (Work, created 2026-08-01 00:00, tags: roadmap) ccc')
    expect(context).toContain('[1] (Work, created 2026-08-01 00:00, tags: roadmap) aaa')
    expect(context).not.toContain('[2] (Work, created 2026-08-01 00:00, tags: roadmap) aaa')
  })

  it('exposes created_at so the model can answer "when did I create that note?"', () => {
    const notes = [note('1', 'reminder to buy groceries')]
    const context = buildNotesContext(notes, numberById(notes))
    expect(context).toContain('created 2026-08-01 00:00')
  })

  it('renders an empty block for no notes', () => {
    expect(buildNotesContext([], new Map())).toBe('<notes>\n(no notes)\n</notes>')
  })
})

describe('buildLibrarianSystemPrompt', () => {
  it('combines the rule block with the notes block', () => {
    const notes = [note('1', 'hello')]
    const prompt = buildLibrarianSystemPrompt(notes, numberById(notes))
    expect(prompt).toContain(LIBRARIAN_SYSTEM_PROMPT)
    expect(prompt).toContain('<notes>')
    expect(prompt).toContain('hello')
  })
})
