import { describe, expect, it } from 'vitest'
import { ChatRequestSchema, normalizeChatMessages } from './chatApi'

describe('ChatRequestSchema', () => {
  it('accepts a plain user message', () => {
    const parsed = ChatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'hi' }] })
    expect(parsed.success).toBe(true)
  })

  it('rejects empty message lists and unknown roles', () => {
    expect(ChatRequestSchema.safeParse({ messages: [] }).success).toBe(false)
    expect(ChatRequestSchema.safeParse({ messages: [{ role: 'admin', content: 'x' }] }).success).toBe(false)
  })
})

describe('normalizeChatMessages', () => {
  it('passes plain content through', () => {
    expect(normalizeChatMessages([{ role: 'user', content: 'hello' }])).toEqual([
      { role: 'user', content: 'hello' },
    ])
  })

  it('extracts text from parts', () => {
    expect(
      normalizeChatMessages([{ role: 'user', parts: [{ type: 'text', text: 'from parts' }] }]),
    ).toEqual([{ role: 'user', content: 'from parts' }])
  })

  it('drops system and empty messages', () => {
    expect(
      normalizeChatMessages([
        { role: 'system', content: 'ignored' },
        { role: 'user', content: '' },
        { role: 'assistant', content: 'answer' },
      ]),
    ).toEqual([{ role: 'assistant', content: 'answer' }])
  })
})
