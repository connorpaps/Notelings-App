'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAgentStore } from '@/components/office/agentStore'
import { useOfficeViewStore } from '@/components/office/officeViewStore'
import { buildGraphData } from '@/lib/notes/graphData'
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas'
import GraphSidePeek from './GraphSidePeek'

/**
 * M5 Knowledge Graph overlay. Full-screen scrim at z-40 (below GlassModal's
 * z-50), dimming — but not hiding — the live R3F office. Plain `bg-black/60`
 * scrim, NO full-screen backdrop-blur: the office animates behind it and a
 * full-screen backdrop-filter would re-blur every frame (60fps skill).
 */
export default function KnowledgeGraphOverlay() {
  const graphOpen = useOfficeViewStore((state) => state.graphOpen)
  const closeGraph = useOfficeViewStore((state) => state.closeGraph)

  // Stable map selector + useMemo derivation (store gotcha).
  const notesMap = useAgentStore((state) => state.notes)
  const graphData = useMemo(() => buildGraphData(Object.values(notesMap)), [notesMap])

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedTag, setFocusedTag] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="pointer-events-auto fixed inset-0 z-40 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Knowledge graph"
        >
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="liquid-glass flex items-center gap-3 rounded-full px-4 py-2">
                <p className="text-sm font-medium tracking-tight text-white">
                  Knowledge <em className="font-serif font-normal italic text-white/80">Graph</em>
                </p>
                <span className="hidden text-[11px] text-white/50 sm:inline">
                  {tagCount} tags · {noteCount} notes
                </span>
              </div>
              {focusedName && (
                <div className="liquid-glass flex items-center gap-2 rounded-full px-3 py-2">
                  <span className="text-[11px] text-white/70">focusing <span className="text-white">#{focusedName}</span></span>
                  <button
                    type="button"
                    aria-label="Clear tag focus"
                    onClick={() => setFocusedTag(null)}
                    className="flex size-5 items-center justify-center rounded-full bg-white/10 text-white/70 transition-transform duration-200 hover:scale-110 active:scale-95"
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
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <X size={16} />
            </button>
          </div>

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

          <GraphSidePeek noteId={selectedNoteId} onClose={() => setSelectedNoteId(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
