'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { CategorizeResponseSchema, categoryToDestination } from '@/lib/notes/categorization'
import type { NoteCategory } from '@/lib/notes/types'
import { useAgentStore } from '@/components/office/agentStore'
import { browserApiPath } from '@/lib/deployment/mode'

type SubmitNoteInput = string | {
  content: string
  aiEnabled?: boolean
  tags?: string[]
}

/**
 * The M4 core loop: LLM categorize → (server saves to Supabase) → dispatch a
 * robot via the Zustand queue → toast. On LLM failure the route still saves the
 * note as Uncategorized (`degraded`), we toast an error, flag the Red sentinel,
 * and STILL dispatch so the note physically reaches the corkboard. AI-off notes
 * use the distinct Manual state and the same Hallway Bookshelf destination.
 */
export function useSubmitNote() {
  return useCallback(async (input: SubmitNoteInput): Promise<void> => {
    const content = typeof input === 'string' ? input : input.content
    const aiEnabled = typeof input === 'string' ? true : input.aiEnabled ?? true
    const manualTags = typeof input === 'string' ? undefined : input.tags
    const endpoint = browserApiPath(aiEnabled ? '/categorize' : '/notes')
    const submissionId = crypto.randomUUID()
    const enqueue = useAgentStore.getState().enqueueTask
    const signalError = useAgentStore.getState().signalError

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          aiEnabled
            ? { content, submission_id: submissionId }
            : { content, submission_id: submissionId, tags: manualTags ?? [] },
        ),
        // Slightly above the server's 10s LLM timeout so we surface the
        // server's degraded response rather than a client-side abort.
        signal: AbortSignal.timeout(12_000),
      })
      const json: unknown = await res.json()
      if (!res.ok) {
        const message =
          typeof json === 'object' && json !== null && 'error' in json
            ? String((json as { error: unknown }).error)
            : 'Request failed'
        throw new Error(message)
      }
      const parsed = CategorizeResponseSchema.safeParse(json)
      if (!parsed.success) throw new Error('Invalid categorize response')

      const { id, category, tags, degraded } = parsed.data
      // The DB row id rides along so the status-sync hook can advance the
      // note pending → in_transit → filed as the robot works (Phase 2 M1).
      enqueue({ noteId: id, destination: categoryToDestination(category), content, category, tags })
      if (!aiEnabled) {
        toast.success('Manual note saved — agent dispatched to Needs sorting.')
      } else if (degraded) {
        toast.error('LLM unavailable — note saved as Uncategorized and agent dispatched!')
        signalError('red')
      } else {
        toast.success(`Note saved as ${category} and agent dispatched!`)
      }
    } catch {
      // The local animation can still explain what would happen, but it is not
      // a remote save. Never tell the user a failed request was persisted.
      const fallbackCategory: NoteCategory = aiEnabled ? 'Uncategorized' : 'Manual'
      enqueue({ destination: categoryToDestination(fallbackCategory), content, category: fallbackCategory, tags: manualTags ?? [] })
      toast.error(
        aiEnabled
          ? 'Could not reach the categorizer — note queued locally, not saved remotely.'
          : 'Could not reach Notelings — note queued locally, not saved remotely.',
      )
      signalError('red')
    }
  }, [])
}
