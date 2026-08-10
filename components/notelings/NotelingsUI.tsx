'use client'

import { useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import WelcomeScreen from './WelcomeScreen'
import AgentStatusCard from './AgentStatusCard'
import KanbanPanel from './KanbanPanel'
import TerminalDock from './TerminalDock'
import { useTaskCompletionToasts } from './useTaskCompletionToasts'
import { useArchiveToasts } from './useArchiveToasts'
import { useNotesRealtime } from './useNotesRealtime'
import { useNoteSync } from './useNoteSync'
import { useAgentStore } from '@/components/office/agentStore'

type NotelingsUIProps = { enabled?: boolean }

/**
 * Bloom world overlay (M4.2 reskin + Phase 2 control center). Root stays
 * `pointer-events-none`; only interactive surfaces opt in. Composition: brand
 * bar + live agents pill (+ mobile board toggle), three glass agent cards on
 * the left, the live Spatial Board kanban on the right (bottom-sheet on
 * mobile), the terminal dock bottom-center, and the Bloom hero welcome above
 * everything until dismissed.
 */
export default function NotelingsUI({ enabled = true }: NotelingsUIProps) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const [kanbanOpen, setKanbanOpen] = useState(false)
  // Fires 'Success: <Agent> filed your note in <Category>.' per delivery.
  useTaskCompletionToasts()
  // M2: 'Note archived — <Agent> filed it in the trash.' per disposal.
  useArchiveToasts()
  // Phase 2 M1: fetch + realtime-mirror notes into the store; push robot
  // lifecycle transitions (pending → in_transit → filed) to the DB.
  useNotesRealtime()
  useNoteSync()
  const online = useAgentStore(
    (state) => Object.values(state.agents).filter((agent) => agent.status !== 'error').length,
  )

  if (!enabled) return null

  return (
    <>
      {!welcomeDismissed && <WelcomeScreen onInitialize={() => setWelcomeDismissed(true)} />}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col p-6 md:p-10">
        <header className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            {/* Logotype, not a heading: the page keeps one h1 (welcome hero). */}
            <p className="text-2xl font-semibold tracking-tighter text-white">notelings</p>
            <span className="hidden font-serif text-[15px] italic text-white/50 md:inline">second brain</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open task board"
              aria-expanded={kanbanOpen}
              onClick={() => setKanbanOpen((open) => !open)}
              className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95 lg:hidden"
            >
              <LayoutGrid size={16} />
            </button>
            <div className="liquid-glass flex items-center gap-2.5 rounded-full px-4 py-2 text-xs text-white/70">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-white" />
              </span>
              {online} agents online
            </div>
          </div>
        </header>

        <div className="mt-8 flex flex-1 items-start justify-between gap-6">
          <div className="flex flex-col gap-6">
            <AgentStatusCard id="blue" />
            <AgentStatusCard id="green" />
            <AgentStatusCard id="red" />
          </div>
          {/* Desktop: the board is a persistent right rail. */}
          <div className="hidden lg:block">
            <KanbanPanel />
          </div>
        </div>
      </div>
      <TerminalDock />
      {/* Mobile: the board opens as a bottom sheet above the terminal. */}
      {kanbanOpen && (
        <div className="absolute inset-x-3 bottom-44 z-40 lg:hidden">
          <KanbanPanel className="w-full" />
        </div>
      )}
      <Toaster position="bottom-right" />
    </>
  )
}
