'use client'

import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import WelcomeScreen from './WelcomeScreen'
import AgentStatusCard from './AgentStatusCard'
import TaskQueuePanel from './TaskQueuePanel'
import CommandDock from './CommandDock'

type NotelingsUIProps = { enabled?: boolean }

/**
 * The M4 product overlay. Root wrappers follow UI_PROMPTS.md: the layout is
 * `absolute inset-0 z-10 pointer-events-none` so the 3D scene stays
 * interactive; only cards, the dock, and the welcome screen opt in with
 * `pointer-events-auto`. Renders in production — this is the product UI.
 */
export default function NotelingsUI({ enabled = true }: NotelingsUIProps) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  if (!enabled) return null

  return (
    <>
      {!welcomeDismissed && <WelcomeScreen onInitialize={() => setWelcomeDismissed(true)} />}
      <div className="absolute inset-0 z-10 pointer-events-none p-6 md:p-12 flex justify-between items-start">
        <div className="flex flex-col gap-6">
          <AgentStatusCard id="blue" />
          <AgentStatusCard id="green" />
          <AgentStatusCard id="red" />
        </div>
        <TaskQueuePanel />
      </div>
      <CommandDock />
      <Toaster position="top-right" />
    </>
  )
}
