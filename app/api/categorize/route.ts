import { NextResponse } from 'next/server'
import { CategorizeResponseSchema, NoteInputSchema } from '@/lib/notes/categorization'
import type { NoteInput } from '@/lib/notes/categorization'
import { categorizeNote } from '@/lib/notes/categorizeNote'
import { getAuthenticatedContext } from '@/lib/supabase/auth'
import { CATEGORIZE_RATE_LIMIT, isStrictSameOrigin, readJsonBody, RequestBodyError, rateLimit } from '@/lib/apiGuard'
import { logApiFailure, observeApiRoute } from '@/lib/observability'
import { reserveDemoAiUsage } from '@/lib/ai/demoUsage'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  return observeApiRoute(request, 'categorize', async ({ requestId }) => {
  if (!isStrictSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!rateLimit(request, { ...CATEGORIZE_RATE_LIMIT, scope: 'categorize' })) {
    return NextResponse.json(
      { error: 'Too many requests, please slow down' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  const auth = await getAuthenticatedContext()
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let input: NoteInput
  try {
    input = NoteInputSchema.parse(await readJsonBody(request))
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400
    const message = error instanceof RequestBodyError ? error.message : 'Invalid note: must be 1-1000 characters'
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

  let category: 'Work' | 'Admin' | 'Uncategorized' = 'Uncategorized'
  let tags: string[] = []
  let degraded = false
  const aiBudgetAvailable = await reserveDemoAiUsage('categorize')
  try {
    if (!aiBudgetAvailable) throw new Error('Demo AI budget exhausted')
    const result = await categorizeNote(input.content)
    category = result.category
    tags = result.tags
  } catch (error) {
    // MASTER_SPEC_FINAL §6 fallback: 10s timeout or API failure → save as
    // Uncategorized so the user still gets persistence + a dispatched agent.
    logApiFailure('categorize', request, error, requestId)
    degraded = true
  }

  const { data, error } = await auth.supabase
    .from('notes')
    // Phase 2: every created note starts in Pending; the client's status-sync
    // hook advances it to in_transit (robot pickup) and filed (delivery).
    .insert({
      user_id: auth.user.id,
      ...(input.submission_id ? { client_submission_id: input.submission_id } : {}),
      content: input.content,
      category,
      tags,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Could not save the note' }, { status: 500 })
  }

  return NextResponse.json(CategorizeResponseSchema.parse({ id: data.id, category, tags, degraded }))
  })
}
