'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Archive, Check, Pencil, X } from 'lucide-react'
import { browserApiPath } from '@/lib/deployment/mode'
import { toast } from 'sonner'
import { useAgentStore } from '@/components/office/agentStore'
import { timeAgo } from '@/lib/notes/kanban'
import { EditNoteSchema, parseTags, validateTags } from '@/lib/notes/noteEdit'
import { NoteRecordSchema } from '@/lib/notes/notesApi'
import { noteCategoryLabel, type NoteRecord } from '@/lib/notes/types'
import { Spinner } from '@/components/ui/spinner'

const STATUS_DOT: Record<NoteRecord['status'], string> = {
  pending: 'bg-white/40',
  in_transit: 'bg-[#2fa8e0]',
  filed: 'bg-[#43c98b]',
  archived: 'bg-white/20',
}

type GraphSidePeekProps = {
  noteId: string | null
  onClose: () => void
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/30'

/**
 * M5 "Side-Peek": a .liquid-glass-strong right rail to read/edit/archive the
 * clicked note without leaving the graph. The slide-in animates ONLY `x`
 * (transform) and `opacity` — compositor work, no layout thrash over the 3D
 * scene (60fps-animation skill). The static 50px backdrop-blur is bounded to
 * this 400px panel and never animated.
 */
export default function GraphSidePeek({ noteId, onClose }: GraphSidePeekProps) {
  const reduceMotion = useReducedMotion()
  const notes = useAgentStore((state) => state.notes)
  const note = noteId ? (notes[noteId] ?? null) : null

  // Auto-close when the note leaves the vault OR gets archived (agentic
  // archive delivery / delete) — archived notes stay in the store map.
  useEffect(() => {
    if (noteId && (!notes[noteId] || notes[noteId].status === 'archived')) onClose()
  }, [noteId, notes, onClose])

  return (
    <AnimatePresence>
      {note && (
        <motion.aside
          key={note.id}
          // transform + opacity ONLY — compositor-animated.
          initial={{ x: '105%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '105%', opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
          className="liquid-glass-strong pointer-events-auto fixed inset-y-0 right-0 z-50 w-[min(92vw,400px)]"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`graph-note-title-${note.id}`}
        >
          {/* Keyed by note id: switching notes remounts the body, so the edit
              form + editing flag reset naturally (no setState-in-effect). */}
          <SidePeekBody key={note.id} note={note} onClose={onClose} />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

type SidePeekBodyProps = {
  note: NoteRecord
  onClose: () => void
}

function SidePeekBody({ note, onClose }: SidePeekBodyProps) {
  const upsertNote = useAgentStore((state) => state.upsertNote)
  const markNoteArchiving = useAgentStore((state) => state.markNoteArchiving)
  const enqueueArchive = useAgentStore((state) => state.enqueueArchive)
  const logTerminal = useAgentStore((state) => state.logTerminal)
  const archivingNoteIds = useAgentStore((state) => state.archivingNoteIds)

  const [editing, setEditing] = useState(false)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [note.id])
  const archiving = archivingNoteIds.includes(note.id)
  // Archived notes are read-only here (same gate as NoteCard).
  const canManage = note.status !== 'archived'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ content: string; tags: string }>({
    resolver: zodResolver(EditNoteSchema),
    values: { content: note.content, tags: note.tags.join(', ') },
  })

  const onSubmit = handleSubmit(async ({ content, tags }) => {
    const tagList = parseTags(tags)
    const invalid = validateTags(tagList)
    if (invalid) {
      toast.error(invalid)
      return
    }
    try {
      const res = await fetch(browserApiPath(`/notes/${note.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tags: tagList }),
      })
      const json: unknown = await res.json()
      if (!res.ok) throw new Error('Update failed')
      const parsed = NoteRecordSchema.safeParse(json)
      if (!parsed.success) throw new Error('Invalid response')
      upsertNote(parsed.data)
      logTerminal(`Note edited: "${content.slice(0, 24)}"`)
      toast.success('Note updated.')
      setEditing(false)
    } catch {
      toast.error('Could not update the note.')
    }
  })

  const handleArchive = () => {
    markNoteArchiving(note.id)
    logTerminal(`Archive requested: "${note.content.slice(0, 24)}"`)
    toast(`Archiving…`, { id: `archiving-${note.id}` })
    enqueueArchive({ noteId: note.id, category: note.category, content: note.content, tags: note.tags })
    onClose()
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`graph-note-title-${note.id}`} className="sr-only">Note side panel</h2>
          <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/70">
            {noteCategoryLabel(note.category)}
          </span>
          <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[note.status]}`} />
            <span className="text-[10px] text-white/35">{timeAgo(note.created_at)}</span>
          </div>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close note side panel"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <X size={14} />
        </button>
      </div>

      {editing ? (
        <form onSubmit={onSubmit} aria-label="Edit note from graph" className="mt-5 flex flex-1 flex-col gap-4">
          <div className="flex flex-1 flex-col">
            <label htmlFor="graph-edit-content" className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-white/50">
              Content
            </label>
            <textarea
              id="graph-edit-content"
              {...register('content')}
              rows={8}
              aria-invalid={Boolean(errors.content)}
              className={`${inputClass} min-h-0 flex-1 resize-none`}
            />
            {errors.content && (
              <p role="alert" className="mt-1 text-xs text-white/60">{errors.content.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="graph-edit-tags" className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-white/50">
              Tags (comma separated)
            </label>
            <input id="graph-edit-tags" {...register('tags')} aria-invalid={Boolean(errors.tags)} className={inputClass} />
            {errors.tags && (
              <p role="alert" className="mt-1 text-xs text-white/60">{errors.tags.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                reset()
                setEditing(false)
              }}
              className="rounded-full bg-white/10 px-5 py-2 text-sm text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium text-white transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? <Spinner className="size-3.5" /> : <Check size={14} />}
              Save changes
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-[1.65] text-white/85">{note.content}</p>
          {note.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/60">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {canManage && (
            <div className="mt-auto flex items-center gap-2 pt-6">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                {archiving ? <Spinner className="size-3.5" /> : <Archive size={13} />}
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
