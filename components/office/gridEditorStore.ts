'use client'

import { create } from 'zustand'
import type { GridEdit, GridEdits } from './gridEditor'

// v2: bumped after the 2026-08-12 lock-in so the pre-lock-in painted deltas
// (which are now baked into newOfficeGridData.ts) never re-apply on top.
export const GRID_EDITOR_STORAGE_KEY = 'notelings-grid-editor-v2'

function loadEdits(): GridEdits {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(GRID_EDITOR_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Keep only well-formed entries — a corrupt/hand-edited value like
      // {"0,0": "banana"} would otherwise silently unblock a cell.
      const edits: Record<string, GridEdit> = {}
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (/^\d+,\d+$/.test(key) && (value === 'free' || value === 'blocked')) edits[key] = value
      }
      return edits as GridEdits
    }
  } catch {
    // Corrupt storage is ignored — the user starts with a clean slate.
  }
  return {}
}

type GridEditorState = {
  edits: GridEdits
  setEdits: (updater: (edits: GridEdits) => GridEdits) => void
  clearEdits: () => void
  /** Load persisted edits once after mount (lazy — avoids SSR hydration mismatch). */
  hydrate: () => void
}

/**
 * Manual walkable-area overrides from the Nav Grid Editor. Persisted to
 * localStorage so a painting session survives reloads; the baked nav map is
 * untouched until the exported result is locked in.
 *
 * The store starts EMPTY and callers invoke `hydrate()` in a mount effect: the
 * server pre-render must match the client's first render (both no edits), and
 * the persisted edits are only applied client-side after hydration completes.
 */
export const useGridEditorStore = create<GridEditorState>((set) => ({
  edits: {},
  setEdits: (updater) =>
    set((state) => {
      const edits = updater(state.edits)
      try {
        window.localStorage.setItem(GRID_EDITOR_STORAGE_KEY, JSON.stringify(edits))
      } catch {
        // Storage unavailable (private mode / quota) — edits still apply in-session.
      }
      return { edits }
    }),
  clearEdits: () => {
    try {
      window.localStorage.removeItem(GRID_EDITOR_STORAGE_KEY)
    } catch {
      // ignore
    }
    set({ edits: {} })
  },
  hydrate: () =>
    set((state) => {
      // Idempotent: only the first mount may hydrate (never clobber live edits).
      if (Object.keys(state.edits).length > 0) return state
      const edits = loadEdits()
      if (Object.keys(edits).length === 0) return state
      return { edits }
    }),
}))
