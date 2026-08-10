import { z } from 'zod'

/** M4: client-safe chat schemas shared by the /api/chat route and useChat. */
export const ChatRequestSchema = z.object({
  // No hard max: useChat sends the FULL history each request, so a max here
  // would 400 once a conversation outgrows it. The route prunes to the last
  // CHAT_HISTORY_LIMIT messages instead.
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().optional(),
        parts: z.array(z.unknown()).optional(),
      }),
    )
    .min(1),
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
