import 'server-only'
import { embed, embedMany } from 'ai'
import { google } from '@ai-sdk/google'
import { rankByEmbeddings } from './similarity'
import type { NoteRecord } from './types'

/**
 * Embedding retrieval for vaults larger than the context limit (>150 notes).
 * The query and every note content are embedded with Gemini and the top-K
 * most similar notes become the Librarian's context. Non-archived only.
 */
const EMBEDDING_MODEL = google.textEmbeddingModel('gemini-embedding-001')

export async function retrieveRelevantNotes(
  notes: readonly NoteRecord[],
  query: string,
  k: number,
): Promise<NoteRecord[]> {
  const active = notes.filter((note) => note.status !== 'archived')
  if (active.length === 0) return []
  const [{ embeddings }, { embedding }] = await Promise.all([
    embedMany({ model: EMBEDDING_MODEL, values: active.map((note) => note.content) }),
    embed({ model: EMBEDDING_MODEL, value: query }),
  ])
  return rankByEmbeddings(active, embedding, embeddings, k).map(({ note }) => note)
}
