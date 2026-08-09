'use client'

import { motion } from 'framer-motion'
import { Archive, BookOpen, ShieldAlert } from 'lucide-react'
import { useAgentStore } from '@/components/office/agentStore'
import type { AgentId } from '@/components/office/agentDestinations'
import type { AgentState } from '@/components/office/agentState'
import { AGENT_DISPLAY_NAMES } from './completionToasts'
import GlassPanel from './GlassPanel'

const AGENT_META = {
  blue: { title: AGENT_DISPLAY_NAMES.blue, subtitle: 'Librarian', icon: BookOpen },
  green: { title: AGENT_DISPLAY_NAMES.green, subtitle: 'Archivist', icon: Archive },
  red: { title: AGENT_DISPLAY_NAMES.red, subtitle: 'Security / Error', icon: ShieldAlert },
} as const

const STATUS_LABEL: Record<AgentState, string> = {
  idle: 'Idle — awaiting tasks',
  walking: 'Walking — delivering a note',
  processing: 'Processing — at destination',
  error: 'ERROR — LLM unavailable',
}

/**
 * Bloom glass agent card. Grayscale hierarchy per the reference; the only
 * color is the robot's identity (glowing dot + tinted icon). The monochrome
 * glow ring rotates around the glass; the red card pulses when the sentinel
 * errors (its 3D glow also pulses in-scene).
 */
export default function AgentStatusCard({ id }: { id: AgentId }) {
  const status = useAgentStore((state) => state.agents[id].status)
  const color = useAgentStore((state) => state.agents[id].color)
  const meta = AGENT_META[id]
  const Icon = meta.icon
  const isError = status === 'error'

  const card = (
    <GlassPanel
      glow
      className="pointer-events-auto w-[260px] rounded-[2rem] transition-transform duration-300 hover:scale-[1.02] md:w-[300px]"
    >
      <div className="flex flex-col gap-6 p-7">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-full bg-white/10">
            <Icon size={18} strokeWidth={2.5} style={{ color }} />
          </div>
          <span
            aria-hidden
            className="mt-1 size-2 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          />
        </div>
        <div>
          <h2 className="text-lg font-medium tracking-tight text-white">{meta.title}</h2>
          <p className="mt-1 text-[13px] text-white/60">{meta.subtitle}</p>
          <p className="mt-1 text-[13px] leading-[1.6] text-white/50">{STATUS_LABEL[status]}</p>
        </div>
      </div>
    </GlassPanel>
  )

  if (isError) {
    return (
      <motion.div
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {card}
      </motion.div>
    )
  }
  return card
}
