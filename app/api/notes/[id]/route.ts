import { NextResponse } from 'next/server'
import { NotePatchSchema, type NotePatch } from '@/lib/notes/notesApi'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

type RouteContext = { params: Promise<{ id: string }> }

/** Update content, tags, and/or lifecycle status (pending/in_transit/filed/archived). */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  let patch: NotePatch
  try {
    patch = NotePatchSchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { error: 'Invalid update: provide content, tags, or status' },
      { status: 400 },
    )
  }

  const { data, error } = await createServerSupabase()
    .from('notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Could not update the note' }, { status: 404 })
  }
  return NextResponse.json(data)
}

/** Permanently delete a row (used from the archived view). */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { error, count } = await createServerSupabase()
    .from('notes')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error || count === 0) {
    return NextResponse.json({ error: 'Could not delete the note' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
