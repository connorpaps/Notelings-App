import { NextResponse } from 'next/server'
import { CategorizeResponseSchema, ManualNoteInputSchema } from '@/lib/notes/categorization'
import type { ManualNoteInput } from '@/lib/notes/categorization'
import { NotesListSchema } from '@/lib/notes/notesApi'
import { getAuthenticatedContext } from '@/lib/supabase/auth'
import { isSameOrigin, isStrictSameOrigin, readJsonBody, RequestBodyError } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/observability'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Authenticated owner's notes, newest first. The client fetches once on
 * mount and then follows the owner-scoped Realtime channel. */
export async function GET(request: Request) {
  return observeApiRoute(request, 'notes.list', async () => {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const auth = await getAuthenticatedContext(request)
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { data, error } = await auth.supabase
    .from('notes')
    .select('id, content, category, tags, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'Could not load notes' }, { status: 500 })
  }
  const parsed = NotesListSchema.safeParse(data)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid notes payload' }, { status: 500 })
  }
  return NextResponse.json(parsed.data)
  })
}

/** Manual/no-AI capture. The authenticated user supplies optional tags;
 * the server assigns the Manual state and no provider call is made. */
export async function POST(request: Request) {
  return observeApiRoute(request, 'notes.create', async () => {
  if (!isStrictSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const auth = await getAuthenticatedContext(request)
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let input: ManualNoteInput
  try {
    input = ManualNoteInputSchema.parse(await readJsonBody(request))
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400
    const message = error instanceof RequestBodyError ? error.message : 'Invalid manual note: content and optional tags are required'
    return NextResponse.json({ error: message }, { status })
  }

  if (input.submission_id) {
    const { data: existing } = await auth.supabase
      .from('notes')
      .select('id, category, tags')
      .eq('user_id', auth.user.id)
      .eq('client_submission_id', input.submission_id)
      .maybeSingle()
    if (existing) return NextResponse.json(CategorizeResponseSchema.parse({ ...existing, degraded: false }))
  }

  const { data, error } = await auth.supabase
    .from('notes')
    .insert({
      user_id: auth.user.id,
      ...(input.submission_id ? { client_submission_id: input.submission_id } : {}),
      content: input.content,
      category: 'Manual',
      tags: input.tags,
      status: 'pending',
    })
    .select('id, category, tags')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Could not save the note' }, { status: 500 })
  return NextResponse.json(CategorizeResponseSchema.parse({ ...data, degraded: false }))
  })
}
