'use client'

import { Eye, EyeOff, Grid3x3, Network } from 'lucide-react'
import { useOfficeViewStore } from '@/components/office/officeViewStore'

/**
 * Small always-on view controls, rendered in the overlay header. They stay
 * reachable even when "Hide UI" collapses the rest of the chrome, so the user
 * can always bring the UI back, re-open the Nav Grid Editor, or open the M5
 * Knowledge Graph.
 */
export default function OfficeViewControls() {
  const gridEditorOpen = useOfficeViewStore((state) => state.gridEditorOpen)
  const uiHidden = useOfficeViewStore((state) => state.uiHidden)
  const graphOpen = useOfficeViewStore((state) => state.graphOpen)
  const toggleGridEditor = useOfficeViewStore((state) => state.toggleGridEditor)
  const toggleUiHidden = useOfficeViewStore((state) => state.toggleUiHidden)
  const toggleGraph = useOfficeViewStore((state) => state.toggleGraph)

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/5 p-1">
      <button
        type="button"
        onClick={toggleGraph}
        aria-pressed={graphOpen}
        aria-label={graphOpen ? 'Close knowledge graph' : 'Show knowledge graph'}
        title={graphOpen ? 'Close knowledge graph' : 'Show knowledge graph'}
        className={`flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-white/10 active:scale-95 sm:min-w-0 ${
          graphOpen ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
        }`}
      >
        <Network size={13} strokeWidth={2.5} />
        <span className="hidden sm:inline">{graphOpen ? 'Graph open' : 'Graph'}</span>
      </button>
      <button
        type="button"
        onClick={toggleGridEditor}
        aria-pressed={gridEditorOpen}
        aria-label={gridEditorOpen ? 'Hide nav grid editor' : 'Show nav grid editor'}
        title={gridEditorOpen ? 'Hide nav grid editor' : 'Show nav grid editor'}
        className={`flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-white/10 active:scale-95 sm:min-w-0 ${
          gridEditorOpen ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
        }`}
      >
        <Grid3x3 size={13} strokeWidth={2.5} />
        <span className="hidden sm:inline">{gridEditorOpen ? 'Editing nav' : 'Edit nav'}</span>
      </button>
      <button
        type="button"
        onClick={toggleUiHidden}
        aria-pressed={uiHidden}
        aria-label={uiHidden ? 'Show app UI' : 'Hide app UI'}
        title={uiHidden ? 'Show app UI' : 'Hide app UI'}
        className={`flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-white/10 active:scale-95 sm:min-w-0 ${
          uiHidden ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
        }`}
      >
        {uiHidden ? <Eye size={13} strokeWidth={2.5} /> : <EyeOff size={13} strokeWidth={2.5} />}
        <span className="hidden sm:inline">{uiHidden ? 'Show UI' : 'Hide UI'}</span>
      </button>
    </div>
  )
}
