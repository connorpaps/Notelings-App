import { z } from 'zod'
import { NOTE_CONTENT_MAX, NoteCategorySchema } from './categorization'

/**
 * Phase 2 note-management schemas (PHASE_2_SPEC M2). Client-safe module shared
 * by the /api/notes routes and the edit modal — no `server-only` imports.
 */

export const NoteStatusSchema = z.enum(['pending', 'in_transit', 'filed', 'archived'])

/** PATCH body for /api/notes/[id]: at least one of content/tags/status. */
export const NotePatchSchema = z
  .object({
    content: z.string().trim().min(1).max(NOTE_CONTENT_MAX).optional(),
    // Editing may remove ALL tags (empty array is a valid manual tag state).
    tags: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
    status: NoteStatusSchema.optional(),
  })
  .refine((value) => value.content !== undefined || value.tags !== undefined || value.status !== undefined, {
    message: 'At least one field to update is required',
  })
export type NotePatch = z.infer<typeof NotePatchSchema>

/** A full note row as returned by the notes routes. */
export const NoteRecordSchema = z.object({
  id: z.string(),
  content: z.string(),
  category: NoteCategorySchema,
  tags: z.array(z.string()),
  status: NoteStatusSchema,
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
})
export type ApiNoteRecord = z.infer<typeof NoteRecordSchema>

export const NotesListSchema = z.array(NoteRecordSchema)
