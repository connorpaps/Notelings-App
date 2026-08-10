'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BookOpen, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { NoteInputSchema } from '@/lib/notes/categorization'
import { useSubmitNote } from './useSubmitNote'
import GlassPanel from './GlassPanel'

type NoteForm = { content: string }

type CommandDockProps = {
  /** Inside the Terminal dock (M1): drop the floating pill positioning. */
  embedded?: boolean
  /** M4: 'chat' turns the dock into the Ask-the-Librarian input. Default: 'note'. */
  mode?: 'note' | 'chat'
  /** M4: called with the typed question in chat mode. */
  onAsk?: (content: string) => void
}

/**
 * Bloom command dock: a liquid-glass-strong pill with the reference's CTA
 * anatomy (icon in a white/15 circle, hover:scale-105 active:scale-95).
 * Accessible names are unchanged in note mode for the E2E contract; chat mode
 * swaps the placeholder/names to the Librarian.
 */
export default function CommandDock({ embedded = false, mode = 'note', onAsk }: CommandDockProps) {
  const submitNote = useSubmitNote()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoteForm>({
    resolver: zodResolver(NoteInputSchema),
    defaultValues: { content: '' },
  })

  const isChat = mode === 'chat'
  const inputLabel = isChat ? 'Ask the Librarian' : 'Type a new note'
  const submitLabel = isChat ? 'Ask the Librarian' : 'Submit note'

  const onSubmit = handleSubmit(async ({ content }) => {
    if (isChat) {
      await onAsk?.(content)
    } else {
      await submitNote(content)
    }
    reset()
  })

  return (
    <form
      onSubmit={onSubmit}
      aria-label={isChat ? 'Ask the Librarian' : 'New note'}
      className={
        embedded
          ? 'pointer-events-auto w-full'
          : 'pointer-events-auto absolute bottom-8 left-1/2 z-30 w-[min(600px,calc(100vw-2rem))] -translate-x-1/2'
      }
    >
      <GlassPanel strong glow className="rounded-full">
        <div className="flex items-center gap-2 p-2">
          <Input
            {...register('content')}
            aria-label={inputLabel}
            aria-invalid={Boolean(errors.content)}
            placeholder={isChat ? 'Ask the Librarian…' : 'Type a new note…'}
            disabled={isSubmitting}
            className="h-9 flex-1 border-0 bg-transparent px-4 text-sm text-white shadow-none placeholder:text-white/40 focus-visible:ring-0"
          />
          <button
            type="submit"
            aria-label={submitLabel}
            disabled={isSubmitting}
            className="flex h-9 shrink-0 items-center justify-center rounded-full bg-white/10 pr-4 pl-2 text-sm font-medium text-white transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
                <Spinner className="size-4" />
              </span>
            ) : (
              <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
                {isChat ? <BookOpen className="size-4" /> : <Send className="size-4" />}
              </span>
            )}
            <span className="sr-only">{submitLabel}</span>
          </button>
        </div>
      </GlassPanel>
      {errors.content && (
        <p role="alert" className="absolute -top-9 right-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white/70">
          {errors.content.message}
        </p>
      )}
    </form>
  )
}
