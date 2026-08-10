import type { NoteRecord } from './types'

/**
 * Citation resolution for "Ask the Librarian" answers.
 *
 * The LLM cites notes with bracket numbers `[n]`. To make those clickable in
 * the UI, the numbering must be reproducible on BOTH sides from the same data:
 *  - server: labels every note in the <notes> context with its global number;
 *  - client: computes the same map from the realtime store mirror.
 *
 * The global index is: every non-archived note, sorted newest-first by
 * `created_at`, ties broken by `id` — the exact order the server fetches
 * (`.order('created_at', { ascending: false }).order('id')`).
 *
 * This stays correct in every context mode: ≤150 notes (all in context),
 * embedding retrieval (>150 notes, similarity-ranked subset keeps its global
 * numbers), and deterministic counts (over all notes).
 *
 * KNOWN LIMITATION (deliberate): numbers are stable only while the vault is
 * unchanged. A note created after the server's snapshot inserts at the top of
 * the newest-first ordering and shifts every later number, so citations in a
 * previous answer can resolve to a different note once the client mirror
 * updates. Accepted trade-off: v7's stream helper exposes no protocol data
 * part, and the deterministic index keeps citations working across all three
 * context modes without one.
 */

export type CitationMap = Map<number, NoteRecord>

/** Global 1-based citation index over non-archived notes. */
export function buildCitationIndex(notes: readonly NoteRecord[]): CitationMap {
  const active = notes
    .filter((note) => note.status !== 'archived')
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
  return new Map(active.map((note, index) => [index + 1, note]))
}

/** Reverse lookup: note id → citation number. */
export function invertCitationIndex(index: CitationMap): Map<string, number> {
  const byId = new Map<string, number>()
  for (const [n, note] of index) byId.set(note.id, n)
  return byId
}
