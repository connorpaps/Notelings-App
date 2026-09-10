'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAgentStore } from '@/components/office/agentStore'
import { useOfficeViewStore } from '@/components/office/officeViewStore'
import { buildGraphData } from '@/lib/notes/graphData'
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas'
import GraphSidePeek from './GraphSidePeek'
import { useFocusTrap } from './useFocusTrap'

/**
 * M5 Knowledge Graph overlay. A transparent full-screen layer at z-40 (below
 * GlassModal's z-50) keeps the office visible while the bounded graph surface
 * provides the local translucent blur and neural-glass treatment.
 */
export default function KnowledgeGraphOverlay() {
  const graphOpen = useOfficeViewStore((state) => state.graphOpen)
  const reduceMotion = useReducedMotion() ?? false
  const closeGraph = useOfficeViewStore((state) => state.closeGraph)

  // Stable map selector + useMemo derivation (store gotcha).
  const notesMap = useAgentStore((state) => state.notes)
  const graphData = useMemo(() => buildGraphData(Object.values(notesMap)), [notesMap])

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedTag, setFocusedTag] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const titleId = useId()
  const dialogRef = useFocusTrap<HTMLDivElement>({ enabled: graphOpen })

  // Clear transient state at close time (no setState inside effects).
  const handleClose = useCallback(() => {
    setHoveredId(null)
    setFocusedTag(null)
    setSelectedNoteId(null)
    closeGraph()
  }, [closeGraph])

  // Esc closes the side-peek first, then the whole overlay.
  useEffect(() => {
    if (!graphOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedNoteId) setSelectedNoteId(null)
      else handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [graphOpen, selectedNoteId, handleClose])

  const handleNodeClick = (id: string) => {
    const node = graphData.nodes.find((n) => n.id === id)
    if (!node) return
    if (node.type === 'note' && node.noteId) {
      setSelectedNoteId(node.noteId)
    } else {
      // Tag hub click toggles focus mode (dim everything unconnected).
      setFocusedTag((current) => (current === id ? null : id))
      setSelectedNoteId(null)
    }
  }

  const handleBackgroundClick = () => {
    setFocusedTag(null)
    setSelectedNoteId(null)
  }

  const tagCount = graphData.nodes.filter((n) => n.type === 'tag').length
  const noteCount = graphData.nodes.filter((n) => n.type === 'note').length
  const focusedName = focusedTag
    ? (graphData.nodes.find((n) => n.id === focusedTag)?.name ?? null)
    : null

  return (
    <AnimatePresence>
      {graphOpen && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
          ref={dialogRef}
          className="knowledge-graph-overlay pointer-events-auto fixed inset-0 z-40 isolate"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <div className="relative z-20 flex items-center justify-between gap-3 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="liquid-glass flex items-center gap-3 rounded-full px-4 py-2">
                <p id={titleId} className="text-sm font-medium tracking-tight text-white">
                  Knowledge <em className="font-serif font-normal italic text-white/80">Graph</em>
                </p>
                <span className="hidden text-[11px] text-white/50 sm:inline">
                  {tagCount} tags · {noteCount} notes
                </span>
                <span className="hidden border-l border-white/20 pl-3 text-[11px] text-white/50 lg:inline">
                  click a tag to focus · click a note to inspect
                </span>
              </div>
              {focusedName && (
                <div className="liquid-glass flex items-center gap-2 rounded-full px-3 py-2">
                  <span className="text-[11px] text-white/70">focusing <span className="text-white">#{focusedName}</span></span>
                  <button
                    type="button"
                    aria-label="Clear tag focus"
                    onClick={() => setFocusedTag(null)}
                    className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-transform duration-200 hover:scale-110 active:scale-95"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Close knowledge graph"
              onClick={handleClose}
              className="flex size-10 min-h-10 min-w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <X size={16} />
            </button>
          </div>

          <div
            data-knowledge-graph-surface
            className="knowledge-graph-surface absolute inset-x-4 bottom-4 top-[4.75rem] z-10 overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:bottom-8 md:left-[22rem] md:right-[22rem] md:top-24"
          >
            {graphData.nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="liquid-glass rounded-2xl px-6 py-8 text-sm text-white/40">
                  No notes yet — submit a note to grow your brain.
                </p>
              </div>
            ) : (
              <KnowledgeGraphCanvas
                graphData={graphData}
                hoveredId={hoveredId}
                focusedTag={focusedTag}
                onNodeHover={setHoveredId}
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
              />
            )}
          </div>

          <GraphSidePeek noteId={selectedNoteId} onClose={() => setSelectedNoteId(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
