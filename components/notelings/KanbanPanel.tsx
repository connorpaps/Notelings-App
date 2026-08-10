'use client'

import { useMemo, useState } from 'react'
import { Archive } from 'lucide-react'
import { toast } from 'sonner'
import { useAgentStore } from '@/components/office/agentStore'
import { groupNotesByStatus, KANBAN_COLUMNS, statusSort } from '@/lib/notes/kanban'
import type { NoteRecord } from '@/lib/notes/types'
import GlassPanel from './GlassPanel'
import KanbanColumn from './KanbanColumn'
import NoteEditModal from './NoteEditModal'
import ArchivedView from './ArchivedView'

type KanbanPanelProps = {
  className?: string
}

/** The right-side Spatial Board: live Pending / In Transit / Filed columns,
 *  the M2 edit modal, the agentic-archive action, and the archived view. */
export default function KanbanPanel({ className = '' }: KanbanPanelProps) {
  const notes = useAgentStore((state) => state.notes)
  const archivingNoteIds = useAgentStore((state) => state.archivingNoteIds)
  const markNoteArchiving = useAgentStore((state) => state.markNoteArchiving)
  const enqueueArchive = useAgentStore((state) => state.enqueueArchive)
  const logTerminal = useAgentStore((state) => state.logTerminal)
  const grouped = useMemo(() => groupNotesByStatus(Object.values(notes)), [notes])
  const archivedNotes = useMemo(
    () => Object.values(notes).filter((note) => note.status === 'archived').sort(statusSort),
    [notes],
  )
  const [editingNote, setEditingNote] = useState<NoteRecord | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)

  const handleArchive = (note: NoteRecord) => {
    markNoteArchiving(note.id)
    logTerminal(`Archive requested: "${note.content.slice(0, 24)}"`)
    toast(`Archiving…`, { id: `archiving-${note.id}` })
    enqueueArchive({ noteId: note.id, category: note.category, content: note.content, tags: note.tags })
  }

  return (
    <GlassPanel glow className={`pointer-events-auto w-[min(660px,46vw)] rounded-[2rem] ${className}`}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-tight text-white">
            Spatial <em className="font-serif font-normal italic text-white/80">Board</em>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={archivedOpen ? 'Back to live board' : 'Show archived notes'}
              aria-expanded={archivedOpen}
              onClick={() => setArchivedOpen((open) => !open)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-transform duration-200 hover:scale-105 active:scale-95 ${
                archivedOpen ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
              }`}
            >
              <Archive size={12} />
              {archivedNotes.length}
            </button>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">{Object.keys(notes).length} notes</span>
          </div>
        </div>

        {archivedOpen ? (
          <ArchivedView notes={archivedNotes} onBack={() => setArchivedOpen(false)} />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.key}
                title={column.label}
                hint={column.hint}
                notes={grouped[column.key]}
                archivingIds={archivingNoteIds}
                onEdit={setEditingNote}
                onArchive={handleArchive}
              />
            ))}
          </div>
        )}
      </div>

      {editingNote && (
        <NoteEditModal note={editingNote} onClose={() => setEditingNote(null)} />
      )}
    </GlassPanel>
  )
}
