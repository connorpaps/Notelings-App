'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Network, Search, Terminal } from 'lucide-react'
import { useOfficeViewStore } from '@/components/office/officeViewStore'
import CommandDock from './CommandDock'
import TerminalLog from './TerminalLog'
import GlassPanel from './GlassPanel'
import TagExplorerModal from './TagExplorerModal'
import ChatPanel from './ChatPanel'
import { useLibrarianChat } from './useLibrarianChat'
import { useAuthSession } from './useAuthSession'

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
  const [aiEnabled, setAiEnabled] = useState(true)
  const { authenticated } = useAuthSession()
  // Mounted at the dock level so the conversation survives mode toggling.
  const chat = useLibrarianChat()

  return (
    <div className="notelings-terminal-dock pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pt-6 md:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <AnimatePresence>{mode === 'chat' && <ChatPanel chat={chat} />}</AnimatePresence>
      <GlassPanel strong glow className="notelings-terminal-panel w-[min(960px,calc(100vw-2rem))] rounded-[2rem]">
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
                disabled={!aiEnabled || !authenticated}
                onClick={() => setMode('chat')}
                title={aiEnabled ? 'Ask the Librarian' : 'Turn AI on to use chat'}
                className={`pointer-events-auto rounded-full px-3 py-1 text-[11px] transition-transform duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
                  mode === 'chat' ? 'bg-white/20 text-white' : 'text-white/50'
                }`}
              >
                Ask AI
              </button>
              <button
                type="button"
                aria-pressed={aiEnabled}
                aria-label={aiEnabled ? 'Turn AI off for manual capture' : 'Turn AI on'}
                title={aiEnabled ? 'AI on — note text may be sent to Gemini' : 'AI off — manual tags only'}
                onClick={() => {
                  if (aiEnabled) chat.stop()
                  setAiEnabled((enabled) => !enabled)
                  setMode('note')
                }}
                className={`pointer-events-auto rounded-full px-2.5 py-1 text-[11px] transition-transform duration-200 hover:scale-105 active:scale-95 ${
                  aiEnabled ? 'bg-white/10 text-white/60' : 'bg-white/20 text-white'
                }`}
              >
                {aiEnabled ? 'AI on' : 'Manual'}
              </button>
            </div>
            <button
              type="button"
              aria-label="Explore tags"
              disabled={!authenticated}
              onClick={() => setTagExplorerOpen(true)}
              className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <Search size={14} />
            </button>
            <button
              type="button"
              aria-label="Open knowledge graph"
              title="Open knowledge graph"
              onClick={() => useOfficeViewStore.getState().toggleGraph()}
              className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <Network size={14} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <CommandDock embedded mode={mode} aiEnabled={aiEnabled} disabled={!authenticated} onAsk={(content) => chat.sendMessage(content)} />
            <div className="hidden h-10 w-px bg-white/10 md:block" />
            <button
              type="button"
              aria-label={logOpen ? 'Hide event log' : 'Show event log'}
              aria-expanded={logOpen}
              onClick={() => setLogOpen((open) => !open)}
              className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95 md:hidden"
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
