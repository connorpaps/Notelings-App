/**
 * Pure terminal-log helpers (PHASE_2_SPEC M1). The event log lives in the
 * Zustand store but the append/cap/truncate logic is kept here so it is
 * unit-testable without React or the store.
 */

export type TerminalLogLevel = 'info' | 'success' | 'error'

export type TerminalLog = {
  id: string
  ts: number
  level: TerminalLogLevel
  message: string
}

export type TerminalLogInput = { message: string; level?: TerminalLogLevel }

/** Hard cap so the log can never grow unbounded (spec §5: keep 50–100). */
export const TERMINAL_LOG_CAP = 100

let logSequence = 0

function nextLogId(): string {
  logSequence += 1
  return `log-${logSequence}`
}

/** Append one or many entries, dropping the OLDEST beyond `cap`. */
export function appendLog(
  logs: readonly TerminalLog[],
  inputs: TerminalLogInput | readonly TerminalLogInput[],
  cap: number = TERMINAL_LOG_CAP,
): TerminalLog[] {
  const list = Array.isArray(inputs) ? inputs : [inputs]
  if (list.length === 0) return [...logs]
  const ts = Date.now()
  const appended = [
    ...logs,
    ...list.map((input) => ({
      id: nextLogId(),
      ts,
      level: input.level ?? 'info',
      message: input.message,
    })),
  ]
  return appended.length > cap ? appended.slice(appended.length - cap) : appended
}

/** Shorten a note's content for log lines (single line, ellipsized). */
export function truncateContent(content: string, max: number = 48): string {
  if (content.length <= max) return content
  return `${content.slice(0, Math.max(0, max - 1))}…`
}
