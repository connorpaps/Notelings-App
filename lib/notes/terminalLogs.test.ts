import { describe, expect, it } from 'vitest'
import { appendLog, TERMINAL_LOG_CAP, truncateContent } from './terminalLogs'

describe('appendLog', () => {
  it('appends single and batched entries with unique ids', () => {
    const one = appendLog([], { message: 'first' })
    expect(one).toHaveLength(1)
    expect(one[0].message).toBe('first')
    expect(one[0].level).toBe('info')
    const two = appendLog(one, [{ message: 'a' }, { message: 'b', level: 'error' }])
    expect(two).toHaveLength(3)
    expect(two[1].level).toBe('info')
    expect(two[2].level).toBe('error')
    expect(new Set(two.map((e) => e.id)).size).toBe(3)
  })

  it('caps the log at 100 and drops the oldest entries', () => {
    let logs: ReturnType<typeof appendLog> = []
    for (let i = 0; i < TERMINAL_LOG_CAP + 20; i += 1) {
      logs = appendLog(logs, { message: `line ${i}` })
    }
    expect(logs).toHaveLength(TERMINAL_LOG_CAP)
    expect(logs[0].message).toBe('line 20')
    expect(logs[logs.length - 1].message).toBe(`line ${TERMINAL_LOG_CAP + 19}`)
  })

  it('returns a copy for empty input', () => {
    const source = appendLog([], { message: 'x' })
    const result = appendLog(source, [])
    expect(result).toEqual(source)
    expect(result).not.toBe(source)
  })
})

describe('truncateContent', () => {
  it('keeps short content unchanged', () => {
    expect(truncateContent('buy milk')).toBe('buy milk')
  })
  it('ellipsizes long content at the cap', () => {
    const long = 'a'.repeat(60)
    expect(truncateContent(long)).toBe(`${'a'.repeat(47)}…`)
    expect(truncateContent(long)).toHaveLength(48)
  })
  it('respects a custom cap', () => {
    expect(truncateContent('hello world', 8)).toBe('hello w…')
  })
})
