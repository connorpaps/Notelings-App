'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGridEditorStore } from './gridEditorStore'
import { applyEdits, buildLockPayload, collectWalkableCells } from './gridEditor'
import { NEW_OFFICE_GRID_TRANSFORM } from './newOfficeLayout'
import { NEW_OFFICE_EFFECTIVE_BLOCKED } from './newOfficeGrid'

type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Controls for the interactive Nav Grid Editor (shown while ENABLE_GRID_DEBUG).
 * The red squares on the office floor are walkable cells; click/drag to paint
 * or erase them. Edits persist in localStorage; "Copy map" exports the final
 * blocked set as JSON so it can be locked into the nav map
 * (scripts/lock-in-grid.mjs).
 */
export default function GridEditorPanel() {
  const edits = useGridEditorStore((state) => state.edits)
  const clearEdits = useGridEditorStore((state) => state.clearEdits)
  const [open, setOpen] = useState(true)
  const [copyState, setCopyState] = useState<CopyState>('idle')

  // Lazy-load persisted edits after mount (see gridEditorStore — the server
  // pre-render must match the client's first render).
  useEffect(() => {
    useGridEditorStore.getState().hydrate()
  }, [])

  const stats = useMemo(() => {
    const merged = applyEdits(NEW_OFFICE_EFFECTIVE_BLOCKED, edits)
    return {
      painted: collectWalkableCells(merged, NEW_OFFICE_GRID_TRANSFORM).length,
      blocked: merged.size,
      edits: Object.keys(edits).length,
    }
  }, [edits])

  const copyPayload = useMemo(
    () => buildLockPayload(applyEdits(NEW_OFFICE_EFFECTIVE_BLOCKED, edits), NEW_OFFICE_GRID_TRANSFORM),
    [edits],
  )

  const copyMap = async () => {
    try {
      await navigator.clipboard.writeText(copyPayload)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 3000)
  }

  return (
    <div className="pointer-events-auto fixed bottom-24 left-4 z-40 w-80">
      <div className="liquid-glass-strong rounded-2xl border border-white/20 p-4 text-white/90 shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-sans text-sm font-semibold tracking-wide text-white">Nav Grid Editor</h2>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Collapse grid editor' : 'Expand grid editor'}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            {open ? '–' : '+'}
          </button>
        </div>

        {open && (
          <>
            <p className="mb-3 font-sans text-xs leading-relaxed text-white/70">
              Red squares = walkable. <span className="text-white/90">Click or drag</span> on the floor to add or
              remove them (green marker = will add, yellow = will erase). Your edits are saved in this browser.
            </p>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center font-sans text-xs">
              <div className="rounded-lg bg-white/10 px-2 py-1.5">
                <div className="text-base font-semibold text-white">{stats.painted}</div>
                <div className="text-white/60">walkable</div>
              </div>
              <div className="rounded-lg bg-white/10 px-2 py-1.5">
                <div className="text-base font-semibold text-white">{stats.blocked}</div>
                <div className="text-white/60">blocked</div>
              </div>
              <div className="rounded-lg bg-white/10 px-2 py-1.5">
                <div className="text-base font-semibold text-white">{stats.edits}</div>
                <div className="text-white/60">edits</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearEdits}
                className="flex-1 rounded-xl border border-white/20 px-3 py-2 font-sans text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
              >
                Clear edits
              </button>
              <button
                type="button"
                onClick={copyMap}
                className="flex-1 rounded-xl bg-white px-3 py-2 font-sans text-xs font-semibold text-slate-900 transition hover:bg-white/90 active:scale-95"
              >
                {copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Copy failed' : 'Copy map'}
              </button>
            </div>
            {copyState === 'failed' && (
              <details className="mt-2">
                <summary className="cursor-pointer font-sans text-xs text-white/70">
                  Clipboard blocked — copy manually
                </summary>
                <textarea
                  readOnly
                  value={copyPayload}
                  rows={6}
                  className="mt-2 w-full rounded-lg bg-black/40 p-2 font-mono text-[10px] text-white/80"
                />
              </details>
            )}
            <p className="mt-3 font-sans text-[11px] leading-relaxed text-white/50">
              When the office looks right, click <span className="text-white/80">Copy map</span> and paste the JSON to
              lock it into the nav map.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
