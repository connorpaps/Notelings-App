'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, Terminal } from 'lucide-react'
import CommandDock from './CommandDock'
import TerminalLog from './TerminalLog'
import GlassPanel from './GlassPanel'
import TagExplorerModal from './TagExplorerModal'
import ChatPanel from './ChatPanel'
import { useLibrarianChat } from './useLibrarianChat'

type DockMode = 'note' | 'chat'

/**
 * Bottom dock (PHASE_2_SPEC M1): the note input (embedded, left) + the
 * monospace event log (right). On mobile the log collapses behind a toggle so
 * the input and the 3D canvas stay the priority. M3 adds the tag explorer
 * search button; M4 adds the New Note / Ask AI mode toggle + floating chat.
 */
export default function TerminalDock() {
  const [logOpen, setLogOpen] = useState(false)
  const [tagExplorerOpen, setTagExplorerOpen] = useState(false)
  const [mode, setMode] = useState<DockMode>('note')
  // Mounted at the dock level so the conversation survives mode toggling.
  const chat = useLibrarianChat()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 md:p-6">
      <AnimatePresence>{mode === 'chat' && <ChatPanel chat={chat} />}</AnimatePresence>
      <GlassPanel strong glow className="w-[min(960px,calc(100vw-2rem))] rounded-[2rem]">
        <div className="flex flex-col gap-3 p-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <div role="group" aria-label="Dock mode" className="flex gap-1 rounded-full bg-white/10 p-1">
              <button
                type="button"
                aria-pressed={mode === 'note'}
                onClick={() => setMode('note')}
                className={`pointer-events-auto rounded-full px-3 py-1 text-[11px] transition-transform duration-200 hover:scale-105 active:scale-95 ${
                  mode === 'note' ? 'bg-white/20 text-white' : 'text-white/50'
                }`}
              >
                New Note
              </button>
              <button
                type="button"
                aria-pressed={mode === 'chat'}
                onClick={() => setMode('chat')}
                className={`pointer-events-auto rounded-full px-3 py-1 text-[11px] transition-transform duration-200 hover:scale-105 active:scale-95 ${
                  mode === 'chat' ? 'bg-white/20 text-white' : 'text-white/50'
                }`}
              >
                Ask AI
              </button>
            </div>
            <button
              type="button"
              aria-label="Explore tags"
              onClick={() => setTagExplorerOpen(true)}
              className="pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <Search size={14} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <CommandDock embedded mode={mode} onAsk={(content) => chat.sendMessage(content)} />
            <div className="hidden h-10 w-px bg-white/10 md:block" />
            <button
              type="button"
              aria-label={logOpen ? 'Hide event log' : 'Show event log'}
              aria-expanded={logOpen}
              onClick={() => setLogOpen((open) => !open)}
              className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95 md:hidden"
            >
              <Terminal size={15} />
            </button>
            <div className="hidden min-w-0 flex-1 md:block">
              <TerminalLog />
            </div>
          </div>
        </div>
        {logOpen && (
          <div className="border-t border-white/10 p-4 md:hidden">
            <TerminalLog />
          </div>
        )}
      </GlassPanel>
      <TagExplorerModal open={tagExplorerOpen} onClose={() => setTagExplorerOpen(false)} />
    </div>
  )
}
