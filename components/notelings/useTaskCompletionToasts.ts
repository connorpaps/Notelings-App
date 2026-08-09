'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAgentStore } from '@/components/office/agentStore'
import { collectNewCompletions, completionToastMessage } from './completionToasts'

/**
 * M4.1: surfaces the physical-delivery confirmation. The store records a
 * `TaskCompletion` only when a robot finishes filing a note, so subscribing to
 * the append-only log fires exactly one toast per finished task — and never
 * for failures, wandering, or the red sentinel's error recovery.
 */
export function useTaskCompletionToasts() {
  const seenRef = useRef(useAgentStore.getState().completions.length)

  useEffect(() => {
    return useAgentStore.subscribe((state) => {
      const fresh = collectNewCompletions(state.completions, seenRef.current)
      if (fresh.length === 0) return
      seenRef.current = state.completions.length
      for (const completion of fresh) {
        toast.success(completionToastMessage(completion))
      }
    })
  }, [])
}
