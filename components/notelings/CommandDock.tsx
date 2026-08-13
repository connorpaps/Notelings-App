'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { BookOpen, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ManualNoteInputSchema, NoteInputSchema } from '@/lib/notes/categorization'
import { parseTags, validateTags } from '@/lib/notes/noteEdit'
import { useSubmitNote } from './useSubmitNote'
import GlassPanel from './GlassPanel'

type NoteForm = { content: string; tags: string }
const NoteFormSchema = NoteInputSchema.extend({ tags: z.string() })

type CommandDockProps = {
  /** Inside the Terminal dock (M1): drop the floating pill positioning. */
  embedded?: boolean
  /** M4: 'chat' turns the dock into the Ask-the-Librarian input. Default: 'note'. */
  mode?: 'note' | 'chat'
  /** M4: called with the typed question in chat mode. */
  onAsk?: (content: string) => void
  /** Privacy-first manual path; false means no Gemini call. */
  aiEnabled?: boolean
  /** Signed-out users can inspect the office but cannot submit private data. */
  disabled?: boolean
}

/**
 * Bloom command dock: a liquid-glass-strong pill with the reference's CTA
 * anatomy (icon in a white/15 circle, hover:scale-105 active:scale-95).
 * Accessible names are unchanged in note mode for the E2E contract; chat mode
 * swaps the placeholder/names to the Librarian.
 */
export default function CommandDock({ embedded = false, mode = 'note', onAsk, aiEnabled = true, disabled = false }: CommandDockProps) {
  const submitNote = useSubmitNote()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoteForm>({
    resolver: zodResolver(NoteFormSchema),
    defaultValues: { content: '', tags: '' },
  })

  const isChat = mode === 'chat'
  const inputLabel = isChat ? 'Ask the Librarian' : 'Type a new note'
  const submitLabel = isChat ? 'Ask the Librarian' : 'Submit note'

  const onSubmit = handleSubmit(async (data) => {
    if (disabled) return
    try {
      if (isChat) {
        await onAsk?.(data.content)
      } else if (aiEnabled) {
        await submitNote(data.content)
      } else {
        const tags = parseTags(data.tags)
        const invalidTags = validateTags(tags)
        if (invalidTags) throw new Error(invalidTags)
        const manual = ManualNoteInputSchema.safeParse({ content: data.content, tags })
        if (!manual.success) throw new Error('Could not validate the manual note.')
        await submitNote({ content: data.content, aiEnabled: false, tags })
      }
      reset({ content: '', tags: '' })
    } catch (error) {
      // Keep the entered note visible when manual validation fails. Network
      // failures are already surfaced by useSubmitNote; this catches only the
      // local manual validation branch.
      const message = error instanceof Error ? error.message : 'Could not submit note.'
      if (!isChat) toast.error(message)
    }
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
      <GlassPanel strong glow className="rounded-2xl md:rounded-full">
        <div className="flex items-center gap-2 p-2">
          <Input
            {...register('content')}
            aria-label={inputLabel}
            aria-invalid={Boolean(errors.content)}
            placeholder={isChat ? 'Ask the Librarian…' : 'Type a new note…'}
            disabled={isSubmitting || disabled}
            className="h-9 flex-1 border-0 bg-transparent px-4 text-sm text-white shadow-none placeholder:text-white/40 focus-visible:ring-0"
          />
          <button
            type="submit"
            aria-label={submitLabel}
            disabled={isSubmitting || disabled}
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
        {!isChat && !aiEnabled && (
          <div className="border-t border-white/10 px-3 pb-3 pt-2">
            <label htmlFor="manual-tags" className="sr-only">Manual tags</label>
            <Input
              id="manual-tags"
              {...register('tags')}
              aria-label="Manual tags (optional)"
              placeholder="Optional tags, comma separated"
              disabled={isSubmitting || disabled}
              className="h-8 w-full border-white/10 bg-black/20 text-xs text-white placeholder:text-white/30"
            />
            <p className="mt-1.5 text-[10px] text-white/40">
              Manual notes go to Needs sorting; tags are optional.
            </p>
          </div>
        )}
      </GlassPanel>
      {disabled ? (
        <p role="status" className="border-t border-white/10 px-3 pb-3 pt-2 text-[11px] text-white/50">
          Sign in to save notes to your private workspace.
        </p>
      ) : null}
      {errors.content && (
        <p role="alert" className="absolute -top-9 right-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white/70">
          {errors.content.message}
        </p>
      )}
    </form>
  )
}
