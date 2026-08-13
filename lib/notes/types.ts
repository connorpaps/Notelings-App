/**
 * Shared M4/M5 domain types. This module is deliberately free of any Three.js /
 * scene imports so both the server route and client components can import it
 * without dragging the renderer into the API bundle.
 */

/** Persisted note classification plus the explicit no-AI capture state. */
export type NoteCategory = 'Work' | 'Admin' | 'Uncategorized' | 'Manual'

/** User-facing labels for persisted category values. */
export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  Work: 'Work',
  Admin: 'Admin',
  Uncategorized: 'Uncategorized',
  Manual: 'Needs sorting',
}

export function noteCategoryLabel(category: NoteCategory): string {
  return NOTE_CATEGORY_LABELS[category]
}

/**
 * Robot delivery targets in the locked office. The union lives here (light)
 * and is re-exported by `components/office/agentDestinations.ts` for the
 * scene-side constants, keeping the server bundle free of scene modules.
 */
export type TaskDestination = 'whiteboard' | 'printer' | 'corkboard'

/**
 * Phase 2 lifecycle (PHASE_2_SPEC M1): a note is created `pending`, moves to
 * `in_transit` when a robot picks it up, and reaches `filed` at delivery.
 * Archiving is soft (`archived`) and keeps the row restorable.
 */
export type NoteStatus = 'pending' | 'in_transit' | 'filed' | 'archived'

/** A persisted note as stored in Supabase and mirrored in the client store. */
export type NoteRecord = {
  id: string
  content: string
  category: NoteCategory
  tags: string[]
  status: NoteStatus
  created_at: string
  updated_at?: string | null
}
