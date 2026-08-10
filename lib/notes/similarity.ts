import type { NoteRecord } from './types'

/** Pure vector helpers for embedding retrieval (>150 notes). */

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export type ScoredNote = { note: NoteRecord; score: number }

/**
 * Rank non-archived notes by cosine similarity to the query vector and take
 * the top K. Ties are broken deterministically: newer `created_at` first,
 * then lexicographic `id` — so repeated runs and both server/client sides
 * agree.
 */
export function rankByEmbeddings(
  notes: readonly NoteRecord[],
  queryVector: readonly number[],
  noteVectors: readonly (readonly number[])[],
  k: number,
): ScoredNote[] {
  return notes
    .filter((note) => note.status !== 'archived')
    .map((note, i) => ({ note, score: cosineSimilarity(queryVector, noteVectors[i] ?? []) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const byDate = b.note.created_at.localeCompare(a.note.created_at)
      if (byDate !== 0) return byDate
      return a.note.id.localeCompare(b.note.id)
    })
    .slice(0, k)
}
