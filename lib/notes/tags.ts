import type { NoteRecord } from './types'

/** M3: tags only count on live notes — archived notes are retired from the brain. */
const ACTIVE_STATUSES = new Set(['pending', 'in_transit', 'filed'])

function activeNotes(notes: readonly NoteRecord[]): NoteRecord[] {
  return notes.filter((note) => ACTIVE_STATUSES.has(note.status))
}

/** Every distinct tag in the vault (case-insensitive dedupe, first casing wins), sorted. */
export function collectUniqueTags(notes: readonly NoteRecord[]): string[] {
  const byLower = new Map<string, string>()
  for (const note of activeNotes(notes)) {
    for (const tag of note.tags) {
      const key = tag.toLowerCase()
      if (!byLower.has(key)) byLower.set(key, tag)
    }
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b))
}

/** Non-archived notes whose tags contain `tag` (case-insensitive match). */
export function notesWithTag(notes: readonly NoteRecord[], tag: string): NoteRecord[] {
  const needle = tag.toLowerCase()
  return activeNotes(notes).filter((note) => note.tags.some((t) => t.toLowerCase() === needle))
}

/** Count of notes per normalized (lowercased) tag, over non-archived notes. */
export function tagCounts(notes: readonly NoteRecord[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const note of activeNotes(notes)) {
    for (const tag of note.tags) {
      const key = tag.toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}
