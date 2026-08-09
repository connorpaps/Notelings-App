'use client'

import { motion } from 'framer-motion'
import { Archive, BookOpen, ShieldAlert } from 'lucide-react'
import { useAgentStore } from '@/components/office/agentStore'
import type { AgentId } from '@/components/office/agentDestinations'

const AGENT_META = {
  blue: {
    title: 'Blue Agent',
    subtitle: 'Librarian',
    icon: BookOpen,
    gradient: 'linear-gradient(137deg, #FFFFFF 0%, #7DD3FC 45%, #06B6D4 100%)',
  },
  green: {
    title: 'Green Agent',
    subtitle: 'Archivist',
    icon: Archive,
    gradient: 'linear-gradient(137deg, #4ADE80 0%, #22C55E 45%, #166534 100%)',
  },
  red: {
    title: 'Red Agent',
    subtitle: 'Security / Error',
    icon: ShieldAlert,
    gradient: 'linear-gradient(137deg, #FF3D77 0%, #EF4444 45%, #991B1B 100%)',
  },
} as const

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle — awaiting tasks',
  walking: 'Walking — delivering a note',
  processing: 'Processing — at destination',
  error: 'ERROR — LLM unavailable',
}

export default function AgentStatusCard({ id }: { id: AgentId }) {
  const status = useAgentStore((state) => state.agents[id].status)
  const meta = AGENT_META[id]
  const Icon = meta.icon
  const isError = id === 'red' && status === 'error'

  const card = (
    <div className="pointer-events-auto relative flex w-[260px] md:w-[300px] flex-col items-start justify-start group">
      {/* Glow background (crucial, per UI_PROMPTS): blurred gradient behind the card. */}
      <div
        className="pointer-events-none absolute h-full w-full rounded-[40px] opacity-60"
        style={{ background: meta.gradient, filter: 'blur(45px)' }}
      />
      {/* Foreground card with gradient border via background-clip. */}
      <div
        className="relative z-10 self-stretch overflow-hidden rounded-[40px] border-[8px] border-transparent"
        style={{ background: `linear-gradient(#1A1A1C, #1A1A1C) padding-box, ${meta.gradient} border-box` }}
      >
        <div className="flex w-full flex-col justify-between gap-6 p-7">
          <Icon size={32} strokeWidth={2.5} className="text-white/90" />
          <div>
            <h2 className="text-xl font-medium tracking-tight text-white">{meta.title}</h2>
            <p className="mt-1 text-[14px] leading-[1.6] text-gray-400">{meta.subtitle}</p>
            <p className="mt-1 text-[14px] leading-[1.6] text-gray-400">{STATUS_LABEL[status]}</p>
          </div>
        </div>
      </div>
    </div>
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
