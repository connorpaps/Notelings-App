'use client'

import { motion } from 'framer-motion'
import { Archive, BookMarked, Library, Sparkles } from 'lucide-react'
import GlassPanel from './GlassPanel'

const DESTINATION_PILLS = [
  { label: "Manager's Bookshelf", icon: BookMarked },
  { label: 'Filing Cabinets', icon: Archive },
  { label: 'Hallway Bookshelf', icon: Library },
]

/** Bloom hero welcome: the first-viewport moment, reskinned per the reference. */
export default function WelcomeScreen({ onInitialize }: { onInitialize: () => void }) {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="pointer-events-auto"
      >
        <GlassPanel strong glow className="rounded-[2.5rem]">
          <div className="flex w-[min(92vw,540px)] flex-col items-center gap-7 px-10 py-12 md:px-14">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Visionary note-keeping</p>
            <h1 className="text-center text-[40px] font-medium leading-[1.05] tracking-[-0.05em] text-white md:text-[60px]">
              Spatial Second <em className="font-serif font-normal italic text-white/80">Brain</em>
            </h1>
            <p className="max-w-[380px] text-center text-[14px] leading-[1.7] text-white/60">
              Your thoughts and tasks, managed by autonomous agents.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {DESTINATION_PILLS.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-xs text-white/80"
                >
                  <Icon size={13} strokeWidth={2.5} className="text-white/60" />
                  {label}
                </span>
              ))}
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onInitialize}
              className="liquid-glass-strong flex items-center gap-3 rounded-full py-2 pl-2 pr-6 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="size-4" />
              </span>
              Initialize Agents
            </motion.button>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  )
}
