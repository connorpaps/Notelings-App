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
})
export type NoteInput = z.infer<typeof NoteInputSchema>

/** Strict schema forced on the LLM by generateObject (MASTER_SPEC_FINAL §5). */
export const NoteCategorySchema = z.enum(['Work', 'Admin', 'Uncategorized'])

export const CategorizationSchema = z.object({
  category: NoteCategorySchema,
  tags: z.array(z.string().min(1).max(40)).max(5),
})

/** Shape returned by POST /api/categorize. */
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
}

export function categoryToDestination(category: NoteCategory): TaskDestination {
  return CATEGORY_TO_DESTINATION[category]
}
