'use client'

import { useLayoutEffect, useRef } from 'react'
import { useAgentStore } from '@/components/office/agentStore'
import type { TerminalLogLevel } from '@/lib/notes/terminalLogs'

const LEVEL_DOT: Record<TerminalLogLevel, string> = {
  info: 'bg-white/40',
  success: 'bg-white/70',
  error: 'bg-red-400/80',
}

const formatTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour12: false })

/** Monospace event log for the bottom dock (capped at 100 by the store). */
export default function TerminalLog() {
  const logs = useAgentStore((state) => state.terminalLogs)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length])

  return (
    <div
      ref={ref}
      data-terminal-log
      aria-label="Event log"
      className="terminal-log-scroll max-h-[150px] overflow-y-auto pr-2 font-mono text-[11px] leading-[1.8]"
    >
      {logs.length === 0 ? (
        <p className="text-white/30">— waiting for events —</p>
      ) : (
        logs.map((log) => (
          <p key={log.id} className="flex items-baseline gap-2 truncate">
            <span aria-hidden className={`size-1 shrink-0 translate-y-[-1px] rounded-full ${LEVEL_DOT[log.level]}`} />
            <span className="shrink-0 text-white/30">{formatTime(log.ts)}</span>
            <span className={log.level === 'error' ? 'truncate text-white/85' : 'truncate text-white/60'}>
              {log.message}
            </span>
          </p>
        ))
      )}
    </div>
  )
}
