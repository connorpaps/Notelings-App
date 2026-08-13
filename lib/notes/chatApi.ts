import { z } from 'zod'

/** M4: client-safe chat schemas shared by the /api/chat route and useChat. */
export const CHAT_MAX_MESSAGES = 100
export const CHAT_MAX_MESSAGE_CHARS = 8_000
export const CHAT_MAX_PARTS = 32

export const ChatRequestSchema = z.object({
  // The client may resend history, but the request itself is still bounded.
  // The route prunes the accepted history to its context window afterward.
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(CHAT_MAX_MESSAGE_CHARS).optional(),
        parts: z.array(z.unknown()).max(CHAT_MAX_PARTS).optional(),
      }),
    )
    .min(1)
    .max(CHAT_MAX_MESSAGES),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export type ModelMessage = { role: 'user' | 'assistant'; content: string }

/** Normalize UI messages (content or parts[]) to plain-text model messages. */
export function normalizeChatMessages(messages: ChatRequest['messages']): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const message of messages) {
    if (message.role === 'system') continue
    let text = ''
    if (typeof message.content === 'string') text = message.content
    else {
      for (const part of message.parts ?? []) {
        if (part && typeof part === 'object' && 'type' in part && (part as { type?: unknown }).type === 'text') {
          const t = (part as { text?: unknown }).text
          if (typeof t === 'string') text += t
        }
      }
    }
    if (text.trim()) out.push({ role: message.role as 'user' | 'assistant', content: text })
  }
  return out
}
