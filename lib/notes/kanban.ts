import type { NoteRecord } from './types'

/** The three live columns (archived notes live behind a toggle, not a column). */
export const KANBAN_COLUMNS = [
  { key: 'pending', label: 'Pending', hint: 'Awaiting pickup' },
  { key: 'in_transit', label: 'In Transit', hint: 'Robot on the move' },
  { key: 'filed', label: 'Filed', hint: 'Delivered' },
] as const

export type KanbanColumnKey = (typeof KANBAN_COLUMNS)[number]['key']

/** Newest first; ids break timestamp ties deterministically. */
export function statusSort(a: NoteRecord, b: NoteRecord): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
  return a.id < b.id ? 1 : -1
}

/** Group live notes into the three kanban columns; archived notes are hidden. */
export function groupNotesByStatus(
  notes: readonly NoteRecord[],
): Record<KanbanColumnKey, NoteRecord[]> {
  const groups: Record<KanbanColumnKey, NoteRecord[]> = {
    pending: [],
    in_transit: [],
    filed: [],
  }
  for (const note of notes) {
    const group = groups[note.status as KanbanColumnKey]
    if (group) group.push(note)
  }
  for (const key of Object.keys(groups) as KanbanColumnKey[]) {
    groups[key].sort(statusSort)
  }
  return groups
}

/** Compact relative timestamp for note cards. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
