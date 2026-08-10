'use client'

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

type GlassModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Bloom liquid-glass modal: backdrop fade + scale-in, ESC/backdrop close. */
export default function GlassModal({ open, onClose, title, children }: GlassModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="liquid-glass-strong w-[min(92vw,540px)] rounded-[2rem] p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-medium tracking-tight text-white">{title}</h3>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                <X size={15} />
              </button>
            </div>
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
