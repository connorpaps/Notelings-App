'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAgentStore } from '@/components/office/agentStore'
import { TASK_DESTINATION_LABELS } from '@/components/office/agentDestinations'
import GlassPanel from './GlassPanel'

/** Bloom glass queue card. Serif italic accent inside the heading, grayscale list. */
export default function TaskQueuePanel() {
  const taskQueue = useAgentStore((state) => state.taskQueue)

  return (
    <GlassPanel glow className="pointer-events-auto w-[260px] rounded-[2rem] md:w-[300px]">
      <div className="flex flex-col gap-4 p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium tracking-tight text-white">
            Global Task <em className="font-serif font-normal italic text-white/80">Queue</em>
          </h2>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">{taskQueue.length}</span>
        </div>
        {taskQueue.length === 0 ? (
          <p className="text-[14px] leading-[1.6] text-white/50">No pending notes — the office is quiet.</p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
            <AnimatePresence initial={false}>
              {taskQueue.map((task) => (
                <motion.li
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  className="rounded-2xl bg-white/[0.06] px-4 py-3"
                >
                  <p className="truncate text-sm text-white/85">{task.content}</p>
                  <p className="mt-1 text-xs text-white/45">
                    <span className="font-medium text-white/65">{task.category}</span>
                    {' · '}
                    {TASK_DESTINATION_LABELS[task.destination]}
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </GlassPanel>
  )
}
