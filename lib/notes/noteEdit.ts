import { z } from 'zod'
import { NOTE_CONTENT_MAX } from './categorization'

/** Shared caps for manual tag editing (M2 modal + M5 graph side-peek). */
export const MAX_TAGS = 5
export const MAX_TAG_LENGTH = 40

export const EditNoteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Note cannot be empty')
    .max(NOTE_CONTENT_MAX, `Notes are limited to ${NOTE_CONTENT_MAX} characters`),
  // Comma-separated input; parsed + validated by parseTags/validateTags.
  tags: z.string(),
})

export function parseTags(value: string): string[] {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

/** Returns a user-facing error message, or null when valid. */
export function validateTags(tags: string[]): string | null {
  if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return `Tags: at most ${MAX_TAGS}, each up to ${MAX_TAG_LENGTH} characters.`
  }
  return null
}
