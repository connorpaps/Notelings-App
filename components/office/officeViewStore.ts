'use client'

import { create } from 'zustand'

/**
 * Lightweight view toggles shared across the DOM overlay (header controls,
 * NotelingsUI, GridEditorPanel) and the R3F canvas (GridDebugOverlay in
 * AgentLayer) — zustand is the one store that crosses both reconcilers.
 */
type OfficeViewState = {
  /** Whether the Nav Grid Editor (panel + floor overlay) is open. Hidden by default. */
  gridEditorOpen: boolean
  /** Whether the 2D app chrome is hidden (office-only view). */
  uiHidden: boolean
  /** Whether the M5 Knowledge Graph overlay is open. */
  graphOpen: boolean
  toggleGridEditor: () => void
  toggleUiHidden: () => void
  toggleGraph: () => void
  closeGraph: () => void
  /** Test-only: restore defaults. */
  resetForTests: () => void
}

const DEFAULTS = { gridEditorOpen: false, uiHidden: false, graphOpen: false }

export const useOfficeViewStore = create<OfficeViewState>((set) => ({
  ...DEFAULTS,
  toggleGridEditor: () => set((state) => ({ gridEditorOpen: !state.gridEditorOpen })),
  toggleUiHidden: () => set((state) => ({ uiHidden: !state.uiHidden })),
  toggleGraph: () => set((state) => ({ graphOpen: !state.graphOpen })),
  closeGraph: () => set({ graphOpen: false }),
  resetForTests: () => set(DEFAULTS),
}))
