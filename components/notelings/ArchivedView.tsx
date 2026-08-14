'use client'

import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { browserApiPath } from '@/lib/deployment/mode'
import { toast } from 'sonner'
import { useAgentStore } from '@/components/office/agentStore'
import { NoteRecordSchema } from '@/lib/notes/notesApi'
import type { NoteRecord } from '@/lib/notes/types'
import GlassModal from './GlassModal'
import NoteCard from './NoteCard'

type ArchivedViewProps = {
  notes: NoteRecord[]
  onBack: () => void
}

/** M2: the archived notes live behind a toggle — Restore or Delete forever. */
export default function ArchivedView({ notes, onBack }: ArchivedViewProps) {
  const [confirmDelete, setConfirmDelete] = useState<NoteRecord | null>(null)
  const upsertNote = useAgentStore((state) => state.upsertNote)
  const removeNote = useAgentStore((state) => state.removeNote)
  const logTerminal = useAgentStore((state) => state.logTerminal)

  const restore = async (note: NoteRecord) => {
    try {
      const res = await fetch(browserApiPath(`/notes/${note.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'filed' }),
      })
      const json: unknown = await res.json()
      if (!res.ok) throw new Error('Restore failed')
      const parsed = NoteRecordSchema.safeParse(json)
      if (!parsed.success) throw new Error('Invalid response')
      upsertNote(parsed.data)
      logTerminal(`Note restored to the board: "${note.content.slice(0, 24)}"`)
      toast.success('Note restored.')
    } catch {
      toast.error('Could not restore the note.')
    }
  }

  const deleteForever = async (note: NoteRecord) => {
    try {
      const res = await fetch(browserApiPath(`/notes/${note.id}`), { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      removeNote(note.id)
      logTerminal(`Note deleted forever: "${note.content.slice(0, 24)}"`)
      toast.success('Note deleted.')
      setConfirmDelete(null)
    } catch {
      toast.error('Could not delete the note.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 self-start rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <ArrowLeft size={12} />
        Back to board
      </button>
      {notes.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-6 text-center text-xs text-white/30">
          No archived notes.
        </p>
      ) : (
        <div className="terminal-log-scroll flex max-h-[52vh] flex-col gap-2.5 overflow-y-auto pr-1">
          {notes.map((note) => (
            <div key={note.id} className="flex flex-col gap-2">
              <NoteCard note={note} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => restore(note)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
                >
                  Restore
                </button>
                <button
                  type="button"
                  aria-label="Delete note forever"
                  onClick={() => setConfirmDelete(note)}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
                >
                  <Trash2 size={11} />
                  Delete forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GlassModal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete forever?">
        <p className="text-sm leading-relaxed text-white/60">
          This permanently deletes “{confirmDelete?.content.slice(0, 60)}” from your database. This
          cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(null)}
            className="rounded-full bg-white/10 px-5 py-2 text-sm text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => confirmDelete && deleteForever(confirmDelete)}
            className="rounded-full bg-white/15 px-5 py-2 text-sm font-medium text-white transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Delete
          </button>
        </div>
      </GlassModal>
    </div>
  )
}
