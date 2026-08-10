'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAgentStore } from '@/components/office/agentStore'
import { collectUniqueTags, notesWithTag, tagCounts } from '@/lib/notes/tags'
import GlassModal from './GlassModal'
import NoteCard from './NoteCard'
import { Spinner } from '@/components/ui/spinner'

type TagExplorerModalProps = {
  open: boolean
  onClose: () => void
}

/** 'idle' doubles as the loading state (derived), so the effect never sets
 *  state synchronously — the React 19 lint rule is satisfied. */
type LoadState = 'idle' | 'ready' | 'error'

/**
 * M3 Obsidian-style Tag Explorer: unique tags come from Supabase (GET
 * /api/tags); the filtered masonry grid reads the realtime-synced store
 * mirror so it stays instant and live. Archived notes are excluded.
 */
export default function TagExplorerModal({ open, onClose }: TagExplorerModalProps) {
  // Select the stable map, then derive the array (a fresh array in the selector
  // would retrigger useSyncExternalStore every render → infinite loop).
  const notesMap = useAgentStore((state) => state.notes)
  const notes = useMemo(() => Object.values(notesMap), [notesMap])
  const [tags, setTags] = useState<string[] | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open || loadState !== 'idle') return
    let cancelled = false
    fetch('/api/tags')
      .then((res) => {
        if (!res.ok) throw new Error(`tags ${res.status}`)
        return res.json() as Promise<{ tags: string[] }>
      })
      .then((json) => {
        if (cancelled) return
        setTags(json.tags)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [open, loadState])

  const loading = open && loadState === 'idle'
  const failed = loadState === 'error'
  const counts = tagCounts(notes)
  const allTags = tags ?? collectUniqueTags(notes)
  const matches = selected ? notesWithTag(notes, selected) : []

  // Clear the selection whenever the modal closes (ESC/backdrop/button all
  // flow through onClose) so reopening always starts at "All tags".
  const handleClose = () => {
    setSelected(null)
    onClose()
  }

  return (
    <GlassModal open={open} onClose={handleClose} title="Tag Explorer" size="wide">
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-white/50">
            <Spinner className="size-4" />
            Loading tags…
          </div>
        ) : failed ? (
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-6">
            <p className="text-xs text-white/50">Could not load tags.</p>
            <button
              type="button"
              onClick={() => setLoadState('idle')}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              Retry
            </button>
          </div>
        ) : allTags.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center text-xs text-white/30">
            No tags yet — notes get LLM tags as they&apos;re filed.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={selected === null}
                onClick={() => setSelected(null)}
                className={`rounded-full px-3 py-1.5 text-xs transition-transform duration-200 hover:scale-105 active:scale-95 ${
                  selected === null ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                All tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected === tag}
                  onClick={() => setSelected(selected === tag ? null : tag)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-transform duration-200 hover:scale-105 active:scale-95 ${
                    selected === tag ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                  }`}
                >
                  #{tag} <span className="text-white/40">{counts.get(tag.toLowerCase()) ?? 0}</span>
                </button>
              ))}
            </div>
            {selected && (
              <div className="columns-2 gap-3 lg:columns-3">
                {matches.map((note) => (
                  <div key={note.id} className="mb-3 break-inside-avoid">
                    <NoteCard note={note} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </GlassModal>
  )
}
