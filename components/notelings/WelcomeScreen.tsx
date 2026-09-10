'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
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
  const reduceMotion = useReducedMotion() ?? false
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    if (!dialog) return undefined

    const focusable = dialog.querySelector<HTMLElement>('[data-welcome-primary], button, input, [href], select, textarea')
    focusable?.focus()

    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusable?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onInitialize()
        return
      }
      if (event.key !== 'Tab') return
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
      if (elements.length === 0) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', keepFocusInside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', keepFocusInside)
      if (previouslyFocused?.isConnected && !previouslyFocused.hasAttribute('disabled')) previouslyFocused.focus()
    }
  }, [onInitialize])

  return (
    // Above the bottom dock (z-30) so the card's lower actions (demo entry,
    // sign-in) are never covered by the command dock's submit pill.
    <div className="absolute inset-0 z-[35] pointer-events-none flex items-center justify-center overflow-y-auto p-4 md:p-8">
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-description"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut' }}
        className="pointer-events-auto my-auto w-full max-w-[620px]"
      >
        <GlassPanel strong glow className="welcome-panel rounded-[2rem] md:rounded-[2.5rem]">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-6 overflow-y-auto px-5 py-7 sm:px-8 sm:py-9 md:max-h-[calc(100dvh-4rem)] md:px-12 md:py-11">
            <div className="text-center">
              <h1 id="welcome-title" className="text-[38px] font-medium leading-[1.05] tracking-[-0.04em] text-white sm:text-[48px] md:text-[58px]">
                Spatial Second <em className="font-serif font-normal italic text-white/85">Brain</em>
              </h1>
              <p id="welcome-description" className="mx-auto mt-4 max-w-[440px] text-sm leading-[1.7] text-white/75">
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
              <button
                type="button"
                onClick={onBrowseDemo}
                data-welcome-primary
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.16)] transition hover:bg-white/90 active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Compass size={15} />
                Enter demo workspace
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-white/55">
                Explore the full note-to-agent workflow with a resettable shared workspace. No account required.
              </p>
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-white/65">Private workspace</p>
                <AuthControls placement="welcome" onContinue={onInitialize} />
              </div>
            </div>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  )
}
