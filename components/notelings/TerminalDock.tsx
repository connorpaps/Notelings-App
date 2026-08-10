'use client'

import { useState } from 'react'
import { Terminal } from 'lucide-react'
import CommandDock from './CommandDock'
import TerminalLog from './TerminalLog'
import GlassPanel from './GlassPanel'

/**
 * Bottom dock (PHASE_2_SPEC M1): the existing note input (embedded, left) +
 * the monospace event log (right). On mobile the log collapses behind a
 * toggle so the input and the 3D canvas stay the priority.
 */
export default function TerminalDock() {
  const [logOpen, setLogOpen] = useState(false)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 md:p-6">
      <GlassPanel strong glow className="w-[min(960px,calc(100vw-2rem))] rounded-[2rem]">
        <div className="flex items-center gap-4 p-3 md:p-4">
          <CommandDock embedded />
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
        {logOpen && (
          <div className="border-t border-white/10 p-4 md:hidden">
            <TerminalLog />
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
