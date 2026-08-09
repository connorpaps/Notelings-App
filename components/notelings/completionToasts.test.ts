import { describe, expect, it } from 'vitest'
import { AGENT_DISPLAY_NAMES, collectNewCompletions, completionToastMessage } from './completionToasts'
import type { TaskCompletion } from '../office/agentStore'

const completion = (overrides: Partial<TaskCompletion> = {}): TaskCompletion => ({
  id: 'task-1',
  agentId: 'blue',
  category: 'Work',
  destination: 'whiteboard',
  content: 'plan the roadmap',
  completedAt: 1_700_000_000_000,
  ...overrides,
})

describe('completion toast helpers', () => {
  it('names the three agents', () => {
    expect(AGENT_DISPLAY_NAMES).toEqual({
      blue: 'Blue Agent',
      green: 'Green Agent',
      red: 'Red Agent',
    })
  })

  it('returns only completions newer than the seen watermark', () => {
    const completions = [
      completion({ id: 'a' }),
      completion({ id: 'b' }),
      completion({ id: 'c' }),
    ]
    expect(collectNewCompletions(completions, 0).map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(collectNewCompletions(completions, 2).map((c) => c.id)).toEqual(['c'])
    expect(collectNewCompletions(completions, 3)).toEqual([])
    expect(collectNewCompletions([], 0)).toEqual([])
  })

  it('formats the success message with the agent name and category', () => {
    expect(completionToastMessage(completion())).toBe('Success: Blue Agent filed your note in Work.')
    expect(completionToastMessage(completion({ agentId: 'green', category: 'Admin' }))).toBe(
      'Success: Green Agent filed your note in Admin.',
    )
    expect(completionToastMessage(completion({ agentId: 'red', category: 'Uncategorized' }))).toBe(
      'Success: Red Agent filed your note in Uncategorized.',
    )
  })
})
