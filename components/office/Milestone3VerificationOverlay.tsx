'use client'

import { useAgentStore } from './agentStore'
import { TASK_DESTINATION_LABELS } from './agentDestinations'

type Milestone3VerificationOverlayProps = { enabled?: boolean }

export default function Milestone3VerificationOverlay({ enabled = true }: Milestone3VerificationOverlayProps) {
  const taskQueue = useAgentStore((state) => state.taskQueue)
  const agents = useAgentStore((state) => state.agents)
  const enqueueTask = useAgentStore((state) => state.enqueueTask)

  if (process.env.NODE_ENV === 'production' || !enabled) return null

  return (
    <div className="absolute inset-0 z-10 pointer-events-none" aria-label="Milestone 3 task controls">
      <section className="pointer-events-auto absolute left-5 top-5 w-72 rounded-2xl border border-white/15 bg-slate-950/75 p-4 text-white shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Milestone 3</p>
            <h1 className="mt-1 text-sm font-semibold tracking-tight">Agent task console</h1>
          </div>
          <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-[10px] text-cyan-100">
            {taskQueue.length} queued
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl border border-cyan-200/20 bg-cyan-400/15 px-3 py-2 text-left text-xs font-medium text-cyan-50 transition hover:border-cyan-200/50 hover:bg-cyan-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 active:scale-[0.98]"
            onClick={() => enqueueTask({ destination: 'whiteboard', content: 'Verification note', category: 'Work', tags: [] })}
          >
            <span className="block">Send to</span>
            <span className="mt-0.5 block text-cyan-200">Whiteboard</span>
          </button>
          <button
            type="button"
            className="rounded-xl border border-emerald-200/20 bg-emerald-400/15 px-3 py-2 text-left text-xs font-medium text-emerald-50 transition hover:border-emerald-200/50 hover:bg-emerald-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 active:scale-[0.98]"
            onClick={() => enqueueTask({ destination: 'printer', content: 'Verification note', category: 'Admin', tags: [] })}
          >
            <span className="block">Send to</span>
            <span className="mt-0.5 block text-emerald-200">Printer</span>
          </button>
        </div>
        <div className="mt-4 space-y-2" aria-live="polite">
          {(['blue', 'green'] as const).map((id) => {
            const agent = agents[id]
            return (
              <div key={id} className="flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2 text-xs">
                <span className="font-medium capitalize text-white/85">{id}</span>
                <span className="text-white/55">
                  {agent.status}
                  {agent.currentTask ? ` · ${TASK_DESTINATION_LABELS[agent.currentTask.destination]}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
