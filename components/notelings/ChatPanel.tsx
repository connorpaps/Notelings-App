'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import type { UIMessage } from 'ai'
import { useAgentStore } from '@/components/office/agentStore'
import { buildCitationIndex, type CitationMap } from '@/lib/notes/citations'
import GlassPanel from './GlassPanel'
import NoteCard from './NoteCard'
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

/** Renders `[n]` citations as clickable chips resolved via the global index. */
function CitationText({
  text,
  index,
  onSelect,
}: {
  text: string
  index: CitationMap
  onSelect: (n: number) => void
}) {
  const segments = text.split(/(\[\d+\])/g)
  return (
    <>
      {segments.map((segment, i) => {
        const match = segment.match(/^\[(\d+)\]$/)
        if (match) {
          const n = Number(match[1])
          if (index.has(n)) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(n)}
                className="mx-0.5 inline-flex items-center rounded-full bg-white/10 px-1.5 py-0.5 align-baseline text-[10px] font-medium text-white/70 transition-transform duration-200 hover:scale-110 hover:text-white active:scale-95"
              >
                {match[1]}
              </button>
            )
          }
        }
        return <span key={i}>{segment}</span>
      })}
    </>
  )
}

/**
 * M4: the Ask-the-Librarian conversation, floating above the bottom dock.
 * Citation numbers `[n]` in answers resolve through the same deterministic
 * index the server uses, and open an inline note preview when clicked.
 */
export default function ChatPanel({ chat }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion() ?? false
  const notesMap = useAgentStore((state) => state.notes)
  const citationIndex = useMemo(() => buildCitationIndex(Object.values(notesMap)), [notesMap])
  const [openCitation, setOpenCitation] = useState<{ messageId: string; n: number } | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [chat.messages, chat.status, reduceMotion])

  const hasConversation = chat.messages.length > 0 || chat.status === 'submitted'
  const lastAssistant = chat.messages[chat.messages.length - 1]
  const citedNote = openCitation ? citationIndex.get(openCitation.n) : undefined

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
      // Clears the taller M4 dock (toggle row + input row ≈ 140px) so the
      // panel never covers the New Note / Ask AI toggle.
      className="pointer-events-none absolute inset-x-0 bottom-[calc(150px+env(safe-area-inset-bottom))] z-20 flex max-h-[calc(100dvh-9rem)] justify-center overflow-y-auto p-4 md:bottom-[calc(170px+env(safe-area-inset-bottom))]"
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
                  onClick={() => {
                    setOpenCitation(null)
                    chat.setMessages([])
                  }}
                  className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white/50 transition-transform duration-200 hover:scale-110 hover:text-white/80 active:scale-95"
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
              chat.messages.map((message) => {
                const text = messageText(message)
                const isAssistant = message.role === 'assistant'
                return (
                  <div key={message.id} className="flex flex-col gap-2">
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        message.role === 'user'
                          ? 'self-end bg-white/15 text-white'
                          : 'self-start liquid-glass text-white/85'
                      }`}
                    >
                      {isAssistant ? (
                        <CitationText
                          text={text}
                          index={citationIndex}
                          onSelect={(n) => setOpenCitation({ messageId: message.id, n })}
                        />
                      ) : (
                        text
                      )}
                      {isAssistant &&
                        chat.status === 'streaming' &&
                        message.id === lastAssistant?.id && (
                          <span className="ml-0.5 inline-block size-1.5 animate-pulse rounded-full bg-white/70 align-middle" />
                        )}
                    </div>
                    {isAssistant && openCitation?.messageId === message.id && citedNote && (
                      <div className="w-full">
                        <button
                          type="button"
                          aria-label="Close cited note"
                          onClick={() => setOpenCitation(null)}
                          className="mb-1 text-[10px] text-white/40 transition-colors hover:text-white/70"
                        >
                          ▲ note [{openCitation.n}]
                        </button>
                        <NoteCard note={citedNote} />
                      </div>
                    )}
                  </div>
                )
              })
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
