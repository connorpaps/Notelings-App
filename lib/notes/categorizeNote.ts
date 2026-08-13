import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { CategorizationSchema } from './categorization'
import type { AiNoteCategory } from './categorization'

// NOTE: server-only — this module imports the AI SDK and must never be
// imported from client components.
export const LLM_TIMEOUT_MS = 10_000

export type CategorizeNoteResult = { category: AiNoteCategory; tags: string[] }

const SYSTEM_PROMPT =
  'You are the categorizer for a "Second Brain" note app. Classify the note into exactly one ' +
  'category: "Work" (ideas, coding, planning, meeting notes — delivered to the whiteboard), ' +
  '"Admin" (paperwork, printing, errands, logistics — delivered to the printer), or ' +
  '"Uncategorized" (everything else). Extract 1-3 short lowercase tags. Respond with valid JSON only.'

export async function categorizeNote(content: string): Promise<CategorizeNoteResult> {
  const { object } = await generateObject({
    model: google('gemini-2.5-flash'),
    schema: CategorizationSchema,
    system: SYSTEM_PROMPT,
    prompt: content,
    abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    maxRetries: 0,
  })
  return { category: object.category, tags: object.tags }
}
