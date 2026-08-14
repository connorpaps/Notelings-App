import { NextResponse } from 'next/server'
import { NotePatchSchema, type NotePatch } from '@/lib/notes/notesApi'
import { getAuthenticatedContext } from '@/lib/supabase/auth'
import { isStrictSameOrigin, readJsonBody, RequestBodyError } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/observability'

export const runtime = 'nodejs'
export const maxDuration = 30

type RouteContext = { params: Promise<{ id: string }> }

/** Update content, tags, and/or lifecycle status (pending/in_transit/filed/archived). */
export async function PATCH(request: Request, context: RouteContext) {
  return observeApiRoute(request, 'notes.update', async () => {
  if (!isStrictSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const auth = await getAuthenticatedContext(request)
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await context.params
  let patch: NotePatch
  try {
    patch = NotePatchSchema.parse(await readJsonBody(request))
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400
    const message = error instanceof RequestBodyError ? error.message : 'Invalid update: provide content, tags, or status'
    return NextResponse.json({ error: message }, { status })
  }

  const { data, error } = await auth.supabase
    .from('notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, content, category, tags, status, created_at, updated_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Could not update the note' }, { status: 404 })
  }
  return NextResponse.json(data)
  })
}

/** Permanently delete a row (used from the archived view). */
export async function DELETE(request: Request, context: RouteContext) {
  return observeApiRoute(request, 'notes.delete', async () => {
  if (!isStrictSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const auth = await getAuthenticatedContext(request)
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await context.params
  const { error, count } = await auth.supabase
    .from('notes')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error || count === 0) {
    return NextResponse.json({ error: 'Could not delete the note' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
  })
}
