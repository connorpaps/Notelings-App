'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { NoteInputSchema } from '@/lib/notes/categorization'
import { useSubmitNote } from './useSubmitNote'

type NoteForm = { content: string }

export default function CommandDock() {
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

  const onSubmit = handleSubmit(async ({ content }) => {
    await submitNote(content)
    reset()
  })

  return (
    <form
      onSubmit={onSubmit}
      aria-label="New note"
      className="pointer-events-auto absolute bottom-10 left-1/2 z-30 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/50 px-1.5 py-1.5 shadow-lg backdrop-blur-2xl"
    >
      <Input
        {...register('content')}
        aria-label="Type a new note"
        aria-invalid={Boolean(errors.content)}
        placeholder="Type a new note…"
        disabled={isSubmitting}
        className="h-8 border-0 bg-transparent text-sm text-white shadow-none placeholder:text-white/40 focus-visible:ring-0"
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        aria-label="Submit note"
        className="h-9 rounded-full bg-white px-5 text-[#0a1b33] font-semibold hover:bg-white/90 disabled:opacity-60"
      >
        {isSubmitting ? <Spinner className="size-4" /> : <Send className="size-4" />}
        <span className="sr-only">Submit note</span>
      </Button>
      {errors.content && (
        <p
          role="alert"
          className="absolute -top-9 right-0 rounded-full bg-black/70 px-3 py-1 text-xs text-red-300"
        >
          {errors.content.message}
        </p>
      )}
    </form>
  )
}
