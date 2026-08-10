'use client'

import { useEffect, useRef } from 'react'
import { useAgentStore } from '@/components/office/agentStore'
import { collectNewCompletions } from './completionToasts'
import type { NoteStatus } from '@/lib/notes/types'

/**
 * Phase 2 M1 core-loop sync: the store owns robot lifecycle; this hook pushes
 * the transitions to the DB through the server route (service role):
 *   robot dispatched (walking + note task)  → in_transit
 *   delivery completed (completions log)     → filed
 *   archive disposal completed (archive log) → archived
 * Fire-and-forget: failures are logged to the terminal, never thrown, so an
 * offline moment can never break the 3D loop.
 */
async function patchStatus(noteId: string, status: NoteStatus): Promise<void> {
  const res = await fetch(`/api/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`status sync failed: ${res.status}`)
}

/**
 * Deliberate beat so the board visibly reads Pending → In Transit → Filed
 * (and so the INSERT event always lands in the store before the in_transit
 * UPDATE — no ordering race). The robot is already en route; the walk takes
 * far longer than this delay.
 */
export const IN_TRANSIT_DELAY_MS = 1500

export function useNoteSync() {
  const seenCompletions = useRef(useAgentStore.getState().completions.length)
  const seenArchived = useRef(useAgentStore.getState().archivedTasks.length)
  const sentInTransit = useRef(new Set<string>())
  const inTransitTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    return useAgentStore.subscribe((state) => {
      // Robot woke up for a note task → In Transit (after the Pending beat).
      for (const agent of Object.values(state.agents)) {
        const task = agent.currentTask
        if (
          agent.status === 'walking' &&
          task?.kind === 'note' &&
          task.noteId &&
          agent.targetKind === 'task' &&
          !sentInTransit.current.has(task.id)
        ) {
          sentInTransit.current.add(task.id)
          const noteId = task.noteId
          const timer = setTimeout(() => {
            inTransitTimers.current.delete(task.id)
            patchStatus(noteId, 'in_transit').catch(() => {
              useAgentStore.getState().logTerminal('Status sync failed (offline?).', 'error')
            })
          }, IN_TRANSIT_DELAY_MS)
          inTransitTimers.current.set(task.id, timer)
        }
      }

      // Delivery finished → Filed. Cancel a pending in_transit beat if the
      // walk somehow finished before it fired.
      const fresh = collectNewCompletions(state.completions, seenCompletions.current)
      if (fresh.length > 0) {
        seenCompletions.current = state.completions.length
        for (const completion of fresh) {
          const timer = inTransitTimers.current.get(completion.id)
          if (timer) {
            clearTimeout(timer)
            inTransitTimers.current.delete(completion.id)
          }
          if (completion.noteId) {
            patchStatus(completion.noteId, 'filed').catch(() => {
              useAgentStore.getState().logTerminal('Status sync failed (offline?).', 'error')
            })
          }
        }
      }

      // Archive disposal finished → Archived (M2 agentic delete).
      const freshArchived = state.archivedTasks.slice(seenArchived.current)
      if (freshArchived.length > 0) {
        seenArchived.current = state.archivedTasks.length
        for (const archived of freshArchived) {
          if (archived.noteId) {
            patchStatus(archived.noteId, 'archived').catch(() => {
              useAgentStore.getState().logTerminal('Status sync failed (offline?).', 'error')
            })
          }
        }
      }
    })
  }, [])
}
