'use client'

import { useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAgentStore } from '@/components/office/agentStore'
import { browserApiPath } from '@/lib/deployment/mode'

/**
 * M4: Ask-the-Librarian chat state wired to /api/chat. Wraps the official
 * useChat hook so the conversation survives dock-mode toggling, and logs each
 * question to the terminal dock for continuity.
 */
export function useLibrarianChat() {
  const chat = useChat({ transport: new DefaultChatTransport({ api: browserApiPath('/chat') }) })
  const logTerminal = useAgentStore((state) => state.logTerminal)

  const sendMessage = useCallback(
    (content: string) => {
      logTerminal(`Asking the Librarian: "${content.slice(0, 48)}"`)
      void chat.sendMessage({ text: content })
    },
    [chat.sendMessage, logTerminal],
  )

  return { ...chat, sendMessage }
}
