import type { TaskCompletion } from '@/components/office/agentStore'
import type { AgentId } from '@/components/office/agentDestinations'
import { noteCategoryLabel } from '@/lib/notes/types'

/**
 * Pure presentation helpers for the physical-delivery success toast. Kept out
 * of the React component so the formatting contract is unit-testable and the
 * store stays free of UI dependencies. Agent titles mirror AgentStatusCard.
 */
export const AGENT_DISPLAY_NAMES: Record<AgentId, string> = {
  blue: 'Blue Agent',
  green: 'Green Agent',
  red: 'Red Agent',
}

/** Completions that are newer than a caller's already-seen watermark. */
export function collectNewCompletions(
  completions: readonly TaskCompletion[],
  seenCount: number,
): TaskCompletion[] {
  return completions.slice(seenCount)
}

export function completionToastMessage(completion: TaskCompletion): string {
  const agentName = AGENT_DISPLAY_NAMES[completion.agentId] ?? completion.agentId
  return `Success: ${agentName} filed your note in ${noteCategoryLabel(completion.category)}.`
}

/** M2: the agentic-delete confirmation, fired once the note reaches the trash. */
export function archiveToastMessage(completion: TaskCompletion): string {
  const agentName = AGENT_DISPLAY_NAMES[completion.agentId] ?? completion.agentId
  return `Note archived — ${agentName} filed it in the trash.`
}
