'use client'

import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import WelcomeScreen from './WelcomeScreen'
import AgentStatusCard from './AgentStatusCard'
import TaskQueuePanel from './TaskQueuePanel'
import CommandDock from './CommandDock'
import { useTaskCompletionToasts } from './useTaskCompletionToasts'
import { useAgentStore } from '@/components/office/agentStore'

type NotelingsUIProps = { enabled?: boolean }

/**
 * Bloom world overlay (M4.2 reskin). Root stays `pointer-events-none`; only
 * interactive surfaces opt in with `pointer-events-auto`. Composition: slim
 * brand bar + live agents pill on top, three glass agent cards on the left,
 * the glass task queue on the right, the liquid-glass-strong command dock
 * bottom-center, and the Bloom hero welcome panel above everything until
 * dismissed. The office remains the centered stage beneath all of this.
 */
export default function NotelingsUI({ enabled = true }: NotelingsUIProps) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  // Fires 'Success: <Agent> filed your note in <Category>.' per delivery.
  useTaskCompletionToasts()
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
          <div className="liquid-glass flex items-center gap-2.5 rounded-full px-4 py-2 text-xs text-white/70">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-white" />
            </span>
            {online} agents online
          </div>
        </header>

        <div className="mt-8 flex flex-1 items-start justify-between gap-6">
          <div className="flex flex-col gap-6">
            <AgentStatusCard id="blue" />
            <AgentStatusCard id="green" />
            <AgentStatusCard id="red" />
          </div>
          {/* The reference hides its right rail on mobile; the queue follows suit. */}
          <div className="hidden lg:block">
            <TaskQueuePanel />
          </div>
        </div>
      </div>
      <CommandDock />
      <Toaster position="bottom-right" />
    </>
  )
}
