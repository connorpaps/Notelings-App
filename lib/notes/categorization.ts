import { z } from 'zod'
import type { NoteCategory, TaskDestination } from './types'

/** Client-side and server-side note length cap (MASTER_SPEC_FINAL §6). */
export const NOTE_CONTENT_MAX = 1000

export const NoteInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Note cannot be empty')
    .max(NOTE_CONTENT_MAX, `Notes are limited to ${NOTE_CONTENT_MAX} characters`),
  submission_id: z.string().uuid().optional(),
})
export type NoteInput = z.infer<typeof NoteInputSchema>

/** Persisted category values, including the explicit no-AI capture state. */
export const NoteCategorySchema = z.enum(['Work', 'Admin', 'Uncategorized', 'Manual'])

/** Strict schema forced on Gemini; Manual is never an AI output. */
export const AiNoteCategorySchema = z.enum(['Work', 'Admin', 'Uncategorized'])
export type AiNoteCategory = z.infer<typeof AiNoteCategorySchema>

export const CategorizationSchema = z.object({
  category: AiNoteCategorySchema,
  tags: z.array(z.string().min(1).max(40)).max(5),
})

/** Manual/no-AI capture input. The server assigns category=Manual. */
export const ManualNoteInputSchema = NoteInputSchema.extend({
  tags: z.array(z.string().trim().min(1).max(40)).max(5).default([]),
}).strict()
export type ManualNoteInput = z.infer<typeof ManualNoteInputSchema>

/** Shape returned by POST /api/categorize and manual POST /api/notes. */
export const CategorizeResponseSchema = z.object({
  id: z.string(),
  category: NoteCategorySchema,
  tags: z.array(z.string()),
  degraded: z.boolean().optional(),
})
export type CategorizeResponse = z.infer<typeof CategorizeResponseSchema>

/** LLM categories map to existing/validated robot destinations. */
export const CATEGORY_TO_DESTINATION: Record<NoteCategory, TaskDestination> = {
  Work: 'whiteboard',
  Admin: 'printer',
  Uncategorized: 'corkboard',
  Manual: 'corkboard',
}

export function categoryToDestination(category: NoteCategory): TaskDestination {
  return CATEGORY_TO_DESTINATION[category]
}
