import { noteCategoryLabel, type NoteRecord } from './types'

/**
 * M4 "Ask the Librarian" — strict grounding contract (PHASE_2_SPEC_FINAL_UPDATED
 * M4). Kept free of the AI SDK so vitest can test the exact wording.
 */
export const LIBRARIAN_SYSTEM_PROMPT =
  'You are the Librarian of a personal "Second Brain" note vault. You answer questions ' +
  "about the user's notes. STRICT RULES — follow every one:\n" +
  '1. Ground your answer ONLY in the notes in the <notes> section below. Do not use outside ' +
  'knowledge, training data, assumptions, or guesses.\n' +
  '2. Answer with the information the notes actually contain, even if partial. If a note gives ' +
  'only part of an answer, give exactly that part — do not refuse because the answer is partial. ' +
  'Example: a note says "the business lunch was on Tuesday" and the user asks "when was my ' +
  'business lunch" — answer "Tuesday", citing that note.\n' +
  '3. If the notes contain the subject of the question but only as placeholder or meaningless ' +
  'content (e.g., repeated letters like "aaaa"), briefly say what the notes contain and cite ' +
  'them instead of refusing.\n' +
  '4. If the question asks for a count or number, count the matching notes one by one and be ' +
  'exact — never estimate, round, or guess. A note counts as matching a topic if the topic ' +
  'appears in its content OR its tags, and treat word stems as matches (e.g. "test" matches ' +
  '"testing", "tested", "test note").\n' +
  '5. Refuse ONLY when the notes contain nothing relevant to the question. Then refuse explicitly ' +
  'and exactly: "I couldn\'t find any notes related to that." Do not answer, speculate, or elaborate.\n' +
  '6. If there are no notes, always refuse with the exact sentence above.\n' +
  '7. When you do answer, cite the note(s) you used with their bracketed numbers, e.g. [1], [2].\n' +
  '8. Be concise. Never invent facts, dates, or quotes that are not in the notes.'

/** Human-readable created timestamp, e.g. "2026-08-09 05:29" (UTC). */
function createdLabel(createdAt: string | null | undefined): string {
  if (!createdAt) return 'created unknown'
  const trimmed = createdAt.slice(0, 16).replace('T', ' ')
  return `created ${trimmed}`
}

/**
 * Numbered <notes> block. Each note is labeled with its GLOBAL citation
 * number (from `citations.buildCitationIndex`) so `[n]` citations resolve
 * deterministically on the client — valid in every context mode (≤150 all
 * notes, embedding retrieval subset, deterministic counts).
 */
export function buildNotesContext(
  notes: readonly NoteRecord[],
  numberById: ReadonlyMap<string, number>,
): string {
  const active = notes.filter((note) => note.status !== 'archived')
  if (active.length === 0) return '<notes>\n(no notes)\n</notes>'
  const lines = active.map((note) => {
    const n = numberById.get(note.id)
    return `[${n ?? '?'}] (${noteCategoryLabel(note.category)}, ${createdLabel(note.created_at)}, tags: ${note.tags.join(', ') || 'none'}) ${note.content}`
  })
  return `<notes>\n${lines.join('\n')}\n</notes>`
}

export function buildLibrarianSystemPrompt(
  notes: readonly NoteRecord[],
  numberById: ReadonlyMap<string, number>,
): string {
  return `${LIBRARIAN_SYSTEM_PROMPT}\n\n${buildNotesContext(notes, numberById)}`
}
