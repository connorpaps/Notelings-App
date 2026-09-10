import { collectUniqueTags } from './tags'
import type { NoteCategory, NoteRecord } from './types'

/** M5: category identity colors = the robot identity palette (only accents). */
export const CATEGORY_GRAPH_COLOR: Record<NoteCategory, string> = {
  Work: '#2fa8e0',
  Admin: '#43c98b',
  Uncategorized: '#ef4444',
  Manual: '#d6b36a',
}

export type GraphNode = {
  id: string
  type: 'note' | 'tag'
  /** note nodes only */
  noteId?: string
  /** note nodes only — short readable preview for the canvas */
  label?: string
  category?: NoteCategory
  /** tag nodes only — display name (first casing wins) */
  name?: string
  degree: number
}

export type GraphLink = { id: string; source: string; target: string }
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] }

const ACTIVE_STATUSES = new Set(['pending', 'in_transit', 'filed'])

function activeNotes(notes: readonly NoteRecord[]): NoteRecord[] {
  return notes.filter((note) => ACTIVE_STATUSES.has(note.status))
}

function noteSort(a: NoteRecord, b: NoteRecord): number {
  // Newest first; id tiebreak also newest-id-first for full determinism.
  return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
}

/**
 * M5 bipartite transform: tag hubs (white text) + note satellites (dots).
 * Edges run ONLY tag -> note, so multi-tag notes sit between their hubs.
 * Node ids are stable (`tag:<lower>` / `note:<uuid>`) so react-force-graph
 * preserves frozen x/y positions across data changes.
 */
export function buildGraphData(notes: readonly NoteRecord[]): GraphData {
  const active = activeNotes(notes).sort(noteSort)
  const hubNames = new Map<string, string>() // lower -> display casing
  for (const tag of collectUniqueTags(active)) hubNames.set(tag.toLowerCase(), tag)

  const degree = new Map<string, number>()
  for (const note of active) {
    degree.set(`note:${note.id}`, note.tags.length)
    for (const tag of note.tags) {
      const hubId = `tag:${tag.toLowerCase()}`
      degree.set(hubId, (degree.get(hubId) ?? 0) + 1)
    }
  }

  const nodes: GraphNode[] = [
    ...[...hubNames.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lower, display]) => ({
        id: `tag:${lower}`,
        type: 'tag' as const,
        name: display,
        degree: degree.get(`tag:${lower}`) ?? 0,
      })),
    ...active.map((note) => ({
      id: `note:${note.id}`,
      type: 'note' as const,
      noteId: note.id,
      label: note.content.trim().replace(/\s+/g, ' ').slice(0, 42),
      category: note.category,
      degree: degree.get(`note:${note.id}`) ?? 0,
    })),
  ]

  const links: GraphLink[] = active.flatMap((note) =>
    note.tags.map((tag) => ({
      id: `tag:${tag.toLowerCase()}->note:${note.id}`,
      source: `tag:${tag.toLowerCase()}`,
      target: `note:${note.id}`,
    })),
  )

  return { nodes, links }
}

