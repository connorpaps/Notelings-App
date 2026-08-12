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
  toggleGridEditor: () => void
  toggleUiHidden: () => void
}

export const useOfficeViewStore = create<OfficeViewState>((set) => ({
  gridEditorOpen: false,
  uiHidden: false,
  toggleGridEditor: () => set((state) => ({ gridEditorOpen: !state.gridEditorOpen })),
  toggleUiHidden: () => set((state) => ({ uiHidden: !state.uiHidden })),
}))
