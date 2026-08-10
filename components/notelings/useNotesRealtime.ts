'use client'

import { useEffect } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { useAgentStore } from '@/components/office/agentStore'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { NoteRecordSchema, NotesListSchema } from '@/lib/notes/notesApi'

/**
 * Phase 2 M1: mirrors the Supabase `notes` table into the store.
 * 1. One-time fetch via the server route (service role).
 * 2. Live `postgres_changes` subscription (anon key, READ ONLY).
 *
 * CRITICAL (PHASE_2_SPEC §5): the effect returns a cleanup that calls
 * `supabase.removeChannel(channel)`. Without it, React StrictMode's double
 * mount creates zombie channels that leak sockets.
 */
export function useNotesRealtime() {
  useEffect(() => {
    let disposed = false

    fetch('/api/notes')
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/notes ${res.status}`)
        return res.json() as Promise<unknown>
      })
      .then((json) => {
        const parsed = NotesListSchema.safeParse(json)
        if (!parsed.success) throw new Error('Invalid notes payload')
        if (disposed) return
        useAgentStore.getState().setNotes(parsed.data)
        useAgentStore.getState().logTerminal(`Loaded ${parsed.data.length} notes.`)
      })
      .catch(() => {
        if (!disposed) {
          useAgentStore.getState().logTerminal('Could not load notes from server.', 'error')
        }
      })

    let supabase: SupabaseClient | null = null
    let channel: RealtimeChannel | null = null
    try {
      supabase = createBrowserSupabase()
    } catch {
      if (!disposed) {
        useAgentStore.getState().logTerminal('Realtime unavailable (missing env).', 'error')
      }
      return undefined
    }

    channel = supabase.channel('notes-kanban')
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
        const parsed = NoteRecordSchema.safeParse(payload.new)
        if (parsed.success) {
          useAgentStore.getState().upsertNote(parsed.data)
          useAgentStore.getState().logTerminal(`Note created: "${parsed.data.content.slice(0, 24)}"`)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes' }, (payload) => {
        const parsed = NoteRecordSchema.safeParse(payload.new)
        if (parsed.success) {
          useAgentStore.getState().upsertNote(parsed.data)
          useAgentStore.getState().logTerminal(`Note updated: "${parsed.data.content.slice(0, 24)}"`)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' }, (payload) => {
        const old = payload.old as { id?: unknown } | undefined
        const id = String(old?.id ?? '')
        if (id) useAgentStore.getState().removeNote(id)
      })
      .subscribe((status) => {
        if (disposed) return
        if (status === 'SUBSCRIBED') {
          useAgentStore.getState().logTerminal('Realtime connected — live sync on.')
        }
        if (status === 'CHANNEL_ERROR') {
          useAgentStore.getState().logTerminal('Realtime channel error.', 'error')
        }
      })

    return () => {
      disposed = true
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [])
}
