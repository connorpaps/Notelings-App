'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import type { UIMessage } from 'ai'
import GlassPanel from './GlassPanel'
import { Spinner } from '@/components/ui/spinner'
import type { useLibrarianChat } from './useLibrarianChat'

type ChatPanelProps = { chat: ReturnType<typeof useLibrarianChat> }

/** v7 UI messages carry text in `parts`; render the joined text parts. */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/**
 * M4: the Ask-the-Librarian conversation, floating above the bottom dock.
 * Empty until the first question; streams responses with a pulsing cursor.
 */
export default function ChatPanel({ chat }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat.messages, chat.status])

  const hasConversation = chat.messages.length > 0 || chat.status === 'submitted'
  const lastAssistant = chat.messages[chat.messages.length - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      // Clears the taller M4 dock (toggle row + input row ≈ 140px) so the
      // panel never covers the New Note / Ask AI toggle.
      className="pointer-events-none absolute inset-x-0 bottom-[150px] z-20 flex justify-center p-4 md:bottom-[170px]"
    >
      <GlassPanel strong className="pointer-events-auto w-[min(760px,calc(100vw-2rem))] rounded-[2rem]">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium tracking-tight text-white">
              Ask the <em className="font-serif font-normal italic text-white/80">Librarian</em>
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
                grounded · temp 0
              </span>
              {chat.messages.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear conversation"
                  onClick={() => chat.setMessages([])}
                  className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white/50 transition-transform duration-200 hover:scale-110 hover:text-white/80 active:scale-95"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <div
            ref={scrollRef}
            data-chat-log
            className="terminal-log-scroll flex max-h-[38vh] flex-col gap-2.5 overflow-y-auto pr-1"
          >
            {!hasConversation ? (
              <p className="rounded-2xl bg-white/[0.03] px-4 py-6 text-center text-xs text-white/30">
                Ask about anything in your notes — answers are grounded strictly in what you&apos;ve
                filed.
              </p>
            ) : (
              chat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    message.role === 'user'
                      ? 'self-end bg-white/15 text-white'
                      : 'self-start liquid-glass text-white/85'
                  }`}
                >
                  {messageText(message)}
                  {message.role === 'assistant' &&
                    chat.status === 'streaming' &&
                    message.id === lastAssistant?.id && (
                      <span className="ml-0.5 inline-block size-1.5 animate-pulse rounded-full bg-white/70 align-middle" />
                    )}
                </div>
              ))
            )}
            {chat.status === 'submitted' && (
              <div className="flex items-center gap-2 self-start rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-xs text-white/50">
                <Spinner className="size-3" /> Searching your notes…
              </div>
            )}
          </div>
          {chat.error && (
            <p role="alert" className="text-xs text-white/60">
              Something went wrong. Please try again.
            </p>
          )}
        </div>
      </GlassPanel>
    </motion.div>
  )
}
