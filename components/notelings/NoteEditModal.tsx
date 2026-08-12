'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useAgentStore } from '@/components/office/agentStore'
import { EditNoteSchema, parseTags, validateTags } from '@/lib/notes/noteEdit'
import { NoteRecordSchema } from '@/lib/notes/notesApi'
import type { NoteRecord } from '@/lib/notes/types'
import GlassModal from './GlassModal'
import { Spinner } from '@/components/ui/spinner'

type EditNoteForm = { content: string; tags: string }

type NoteEditModalProps = {
  note: NoteRecord
  onClose: () => void
}

/** M2 edit modal: change the text and/or the manual tag set → PATCH → store. */
export default function NoteEditModal({ note, onClose }: NoteEditModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditNoteForm>({
    resolver: zodResolver(EditNoteSchema),
    defaultValues: { content: note.content, tags: note.tags.join(', ') },
  })

  const onSubmit = handleSubmit(async ({ content, tags }) => {
    const tagList = parseTags(tags)
    const invalid = validateTags(tagList)
    if (invalid) {
      toast.error(invalid)
      return
    }
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tags: tagList }),
      })
      const json: unknown = await res.json()
      if (!res.ok) throw new Error('Update failed')
      const parsed = NoteRecordSchema.safeParse(json)
      if (!parsed.success) throw new Error('Invalid response')
      useAgentStore.getState().upsertNote(parsed.data)
      useAgentStore.getState().logTerminal(`Note edited: "${content.slice(0, 24)}"`)
      toast.success('Note updated.')
      onClose()
    } catch {
      toast.error('Could not update the note.')
    }
  })

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/30 aria-invalid:border-white/40'

  return (
    <GlassModal open onClose={onClose} title="Edit note">
      <form onSubmit={onSubmit} aria-label="Edit note form" className="flex flex-col gap-4">
        <div>
          <label htmlFor="edit-content" className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-white/50">
            Content
          </label>
          <textarea
            id="edit-content"
            {...register('content')}
            rows={4}
            aria-invalid={Boolean(errors.content)}
            className={`${inputClass} resize-none`}
          />
          {errors.content && (
            <p role="alert" className="mt-1 text-xs text-white/60">{errors.content.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="edit-tags" className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-white/50">
            Tags (comma separated)
          </label>
          <input
            id="edit-tags"
            {...register('tags')}
            aria-invalid={Boolean(errors.tags)}
            className={inputClass}
          />
          {errors.tags && (
            <p role="alert" className="mt-1 text-xs text-white/60">{errors.tags.message}</p>
          )}
        </div>
        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-5 py-2 text-sm text-white/70 transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium text-white transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            {isSubmitting && <Spinner className="size-3.5" />}
            Save changes
          </button>
        </div>
      </form>
    </GlassModal>
  )
}
