'use client'

import { useMemo } from 'react'
import { useAgentStore } from '@/components/office/agentStore'
import { groupNotesByStatus, KANBAN_COLUMNS } from '@/lib/notes/kanban'
import GlassPanel from './GlassPanel'
import KanbanColumn from './KanbanColumn'

type KanbanPanelProps = {
  className?: string
}

/** The right-side Spatial Board: live Pending / In Transit / Filed columns.
 *  Driven by the store's `notes` mirror (initial fetch + Realtime). */
export default function KanbanPanel({ className = '' }: KanbanPanelProps) {
  const notes = useAgentStore((state) => state.notes)
  const archivingNoteIds = useAgentStore((state) => state.archivingNoteIds)
  const grouped = useMemo(() => groupNotesByStatus(Object.values(notes)), [notes])

  return (
    <GlassPanel glow className={`pointer-events-auto w-[min(660px,46vw)] rounded-[2rem] ${className}`}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-tight text-white">
            Spatial <em className="font-serif font-normal italic text-white/80">Board</em>
          </h2>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">{Object.keys(notes).length} notes</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.key}
              title={column.label}
              hint={column.hint}
              notes={grouped[column.key]}
              archivingIds={archivingNoteIds}
            />
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}
