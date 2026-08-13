'use client'

import { motion } from 'framer-motion'
import { Archive, BookMarked, Compass, Library } from 'lucide-react'
import GlassPanel from './GlassPanel'
import AuthControls from './AuthControls'

const DESTINATION_PILLS = [
  { label: "Manager's Bookshelf", icon: BookMarked },
  { label: 'Filing Cabinets', icon: Archive },
  { label: 'Hallway Bookshelf', icon: Library },
]

type WelcomeScreenProps = {
  onInitialize: () => void
  onBrowseDemo: () => void
}

/**
 * The first viewport is also the access decision: sign in to a private
 * workspace, create an account, or enter the shared full-access demo
 * workspace (auto sign-in to the demo account).
 */
export default function WelcomeScreen({ onInitialize, onBrowseDemo }: WelcomeScreenProps) {
  return (
    // Above the bottom dock (z-30) so the card's lower actions (demo entry,
    // sign-in) are never covered by the command dock's submit pill.
    <div className="absolute inset-0 z-[35] pointer-events-none flex items-center justify-center overflow-y-auto p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="pointer-events-auto my-auto w-full max-w-[620px]"
      >
        <GlassPanel strong glow className="rounded-[2rem] md:rounded-[2.5rem]">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-6 overflow-y-auto px-5 py-7 sm:px-8 sm:py-9 md:max-h-[calc(100dvh-4rem)] md:px-12 md:py-11">
            <div className="text-center">
              <h1 className="text-[38px] font-medium leading-[1.05] tracking-[-0.04em] text-white sm:text-[48px] md:text-[58px]">
                Spatial Second <em className="font-serif font-normal italic text-white/85">Brain</em>
              </h1>
              <p className="mx-auto mt-4 max-w-[440px] text-sm leading-[1.7] text-white/75">
                Capture a thought and watch your Librarian agents place it inside a living 3D office.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {DESTINATION_PILLS.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="liquid-glass flex items-center gap-2 rounded-full px-3.5 py-2 text-xs text-white/85"
                >
                  <Icon size={13} strokeWidth={2.5} className="text-white/70" />
                  {label}
                </span>
              ))}
            </div>

            <div className="border-t border-white/15 pt-5">
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-white/65">Choose how to enter</p>
              <AuthControls placement="welcome" onContinue={onInitialize} />
              <button
                type="button"
                onClick={onBrowseDemo}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:border-white/35 hover:bg-white/10 hover:text-white active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <Compass size={15} />
                Enter demo workspace
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-white/55">
                Demo signs you into a shared workspace with full access — perfect for testing the office, notes, and Librarian.
              </p>
            </div>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  )
}
