'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAgentStore } from '@/components/office/agentStore'
import { TASK_DESTINATION_LABELS } from '@/components/office/agentDestinations'

const QUEUE_GRADIENT = 'linear-gradient(137deg, #4361EE 0%, #E0AEFF 45%, #F72585 100%)'

export default function TaskQueuePanel() {
  const taskQueue = useAgentStore((state) => state.taskQueue)

  return (
    <div className="pointer-events-auto relative flex w-[260px] md:w-[300px] flex-col items-start justify-start">
      <div
        className="pointer-events-none absolute h-full w-full rounded-[40px] opacity-60"
        style={{ background: QUEUE_GRADIENT, filter: 'blur(45px)' }}
      />
      <div
        className="relative z-10 self-stretch overflow-hidden rounded-[40px] border-[8px] border-transparent"
        style={{ background: `linear-gradient(#1A1A1C, #1A1A1C) padding-box, ${QUEUE_GRADIENT} border-box` }}
      >
        <div className="flex w-full flex-col justify-between gap-4 p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-medium tracking-tight text-white">Global Task Queue</h2>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">{taskQueue.length}</span>
          </div>
          {taskQueue.length === 0 ? (
            <p className="text-[14px] leading-[1.6] text-gray-400">No pending notes — the office is quiet.</p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
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
                    <p className="truncate text-sm text-white/90">{task.content}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      <span className="font-medium text-white/70">{task.category}</span>
                      {' · '}
                      {TASK_DESTINATION_LABELS[task.destination]}
                    </p>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
