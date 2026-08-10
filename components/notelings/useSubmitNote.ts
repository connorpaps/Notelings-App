'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { CategorizeResponseSchema, categoryToDestination } from '@/lib/notes/categorization'
import { useAgentStore } from '@/components/office/agentStore'

/**
 * The M4 core loop: LLM categorize → (server saves to Supabase) → dispatch a
 * robot via the Zustand queue → toast. On LLM failure the route still saves the
 * note as Uncategorized (`degraded`), we toast an error, flag the Red sentinel,
 * and STILL dispatch so the note physically reaches the corkboard.
 */
export function useSubmitNote() {
  return useCallback(async (content: string): Promise<void> => {
    const enqueue = useAgentStore.getState().enqueueTask
    const signalError = useAgentStore.getState().signalError

    try {
      const res = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
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
      if (degraded) {
        toast.error('LLM unavailable — note saved as Uncategorized and agent dispatched!')
        signalError('red')
      } else {
        toast.success(`Note saved as ${category} and agent dispatched!`)
      }
    } catch {
      // Section 6 fallback: the route itself is unreachable (network failure),
      // so no DB row can be written — dispatch locally as Uncategorized and
      // flag the Red sentinel. Documented MVP limitation.
      enqueue({ destination: 'corkboard', content, category: 'Uncategorized', tags: [] })
      toast.error('Could not reach the categorizer — note saved as Uncategorized and agent dispatched!')
      signalError('red')
    }
  }, [])
}
