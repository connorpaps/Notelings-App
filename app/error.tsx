'use client'

import { useEffect } from 'react'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep production diagnostics free of note content and provider details.
    console.error(JSON.stringify({ type: 'client_error_boundary', event: 'render_failed' }))
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-black/20 px-6 text-white">
      <section className="liquid-glass-strong w-full max-w-md rounded-[2rem] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-white/40">Office interruption</p>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">
          The <em className="font-serif font-normal italic text-white/75">Librarians</em> need a reset.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          The workspace hit an unexpected problem. Your note content was not included in this message.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 active:scale-[.98]"
        >
          Try again
        </button>
      </section>
    </main>
  )
}
