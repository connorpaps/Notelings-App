import { NextResponse } from 'next/server'
import { NotesListSchema } from '@/lib/notes/notesApi'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/** All notes, newest first. Read-only; the client fetches once on mount and
 *  then follows the Realtime channel. Service role keeps the anon key
 *  read-only. */
export async function GET() {
  const { data, error } = await createServerSupabase()
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Could not load notes' }, { status: 500 })
  }
  const parsed = NotesListSchema.safeParse(data)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid notes payload' }, { status: 500 })
  }
  return NextResponse.json(parsed.data)
}
