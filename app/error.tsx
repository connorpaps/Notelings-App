'use client'

import { useEffect } from 'react'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep production diagnostics free of note content and provider details.
    console.error(JSON.stringify({ type: 'client_error_boundary', event: 'render_failed' }))
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-6 text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-900/10 bg-white/90 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Office interruption</p>
        <h1 className="mt-3 text-2xl font-medium tracking-tight text-slate-950">
          The <em className="font-serif font-normal italic text-slate-700">Librarians</em> need a reset.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The workspace hit an unexpected problem. Your note content was not included in this message.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/30"
        >
          Try again
        </button>
      </section>
    </main>
  )
}
