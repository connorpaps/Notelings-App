'use client'

import { motion } from 'framer-motion'
import { timeAgo } from '@/lib/notes/kanban'
import type { NoteRecord } from '@/lib/notes/types'

type NoteCardProps = {
  note: NoteRecord
  /** Archive walk in progress — shows a subtle pulse (M2). */
  archiving?: boolean
}

const STATUS_DOT: Record<NoteRecord['status'], string> = {
  pending: 'bg-white/40',
  in_transit: 'bg-[#2fa8e0]',
  filed: 'bg-[#43c98b]',
  archived: 'bg-white/20',
}

/** A single note on the Spatial Board (PHASE_2_SPEC M1). Grayscale glass. */
export default function NoteCard({ note, archiving = false }: NoteCardProps) {
  return (
    <motion.article
      whileHover={{ scale: 1.02 }}
      className="liquid-glass cursor-default rounded-2xl p-3.5 transition-transform duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[13px] leading-[1.5] text-white/85">{note.content}</p>
        <span aria-hidden className={`mt-1 size-1.5 shrink-0 rounded-full ${STATUS_DOT[note.status]}`} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/65">{note.category}</span>
        {note.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/45">
            #{tag}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-white/35">{timeAgo(note.created_at)}</span>
        {archiving && (
          <span className="flex items-center gap-1.5 text-[10px] text-white/60">
            <motion.span
              aria-hidden
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              className="size-1 rounded-full bg-white/70"
            />
            Archiving…
          </span>
        )}
      </div>
    </motion.article>
  )
}
