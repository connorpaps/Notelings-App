'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { NoteRecord } from '@/lib/notes/types'
import NoteCard from './NoteCard'

type KanbanColumnProps = {
  title: string
  hint: string
  notes: NoteRecord[]
  archivingIds: string[]
  onEdit?: (note: NoteRecord) => void
  onArchive?: (note: NoteRecord) => void
}

const COLUMN_DOT: Record<string, string> = {
  Pending: 'bg-white/40',
  'In Transit': 'bg-[#2fa8e0]',
  Filed: 'bg-[#43c98b]',
}

/** One kanban column (Pending / In Transit / Filed). */
export default function KanbanColumn({ title, hint, notes, archivingIds, onEdit, onArchive }: KanbanColumnProps) {
  const reduceMotion = useReducedMotion() ?? false

  return (
    <section aria-label={`${title} column`} className="notelings-board-column flex min-w-[120px] flex-1 flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`size-1.5 rounded-full ${COLUMN_DOT[title] ?? 'bg-white/40'}`} />
        <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">{title}</h3>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">{notes.length}</span>
      </div>
      <p className="text-[11px] text-white/40">{hint}</p>
      <div
        aria-live="polite"
        className="terminal-log-scroll flex max-h-[46vh] flex-col gap-2 overflow-y-auto pr-1"
      >
        <AnimatePresence initial={false}>
          {notes.map((note) => (
            <motion.div
              key={note.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
            >
              <NoteCard
                note={note}
                archiving={archivingIds.includes(note.id)}
                onEdit={onEdit ? () => onEdit(note) : undefined}
                onArchive={onArchive ? () => onArchive(note) : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {notes.length === 0 && (
          <p className="rounded-2xl bg-white/[0.03] px-3 py-4 text-center text-[11px] text-white/30">Quiet.</p>
        )}
      </div>
    </section>
  )
}
