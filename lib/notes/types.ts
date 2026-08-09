/**
 * Shared M4 domain types. This module is deliberately free of any Three.js /
 * scene imports so both the server route and client components can import it
 * without dragging the renderer into the API bundle.
 */

/** The three LLM-assigned buckets (MASTER_SPEC_FINAL §5). */
export type NoteCategory = 'Work' | 'Admin' | 'Uncategorized'

/**
 * Robot delivery targets in the locked office. The union lives here (light)
 * and is re-exported by `components/office/agentDestinations.ts` for the
 * scene-side constants, keeping the server bundle free of scene modules.
 */
export type TaskDestination = 'whiteboard' | 'printer' | 'corkboard'
