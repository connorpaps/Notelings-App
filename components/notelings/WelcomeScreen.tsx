'use client'

import { motion } from 'framer-motion'

export default function WelcomeScreen({ onInitialize }: { onInitialize: () => void }) {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="pointer-events-auto flex flex-col items-center gap-6 rounded-[48px] border border-white/10 bg-black/30 p-12 backdrop-blur-md"
      >
        <h1 className="font-[family-name:var(--font-outfit)] text-center text-[42px] md:text-[56px] font-medium tracking-tight text-white">
          Spatial Second Brain
        </h1>
        <p className="font-[family-name:var(--font-inter)] text-center text-[14px] md:text-[15px] text-[#94A3B8]">
          Your thoughts and tasks, managed by autonomous agents.
        </p>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onInitialize}
          className="mt-2 rounded-full bg-[#0a152d] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-black/40 transition-colors hover:bg-[#12234a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          Initialize Agents
        </motion.button>
      </motion.div>
    </div>
  )
}
