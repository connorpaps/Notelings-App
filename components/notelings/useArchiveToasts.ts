'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAgentStore } from '@/components/office/agentStore'
import { archiveToastMessage } from './completionToasts'

/**
 * M2: surfaces the agentic-delete confirmation. The store appends to
 * `archivedTasks` only when a robot finishes the archive walk (destination →
 * trash), so this fires exactly one toast per archived note — and dismisses
 * the "Archiving…" placeholder that the Kanban raised at request time.
 */
export function useArchiveToasts() {
  const seenRef = useRef(useAgentStore.getState().archivedTasks.length)

  useEffect(() => {
    return useAgentStore.subscribe((state) => {
      const fresh = state.archivedTasks.slice(seenRef.current)
      if (fresh.length === 0) return
      seenRef.current = state.archivedTasks.length
      for (const archived of fresh) {
        if (archived.noteId) toast.dismiss(`archiving-${archived.noteId}`)
        toast.success(archiveToastMessage(archived))
      }
    })
  }, [])
}
