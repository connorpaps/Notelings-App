import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedContext } from '@/lib/supabase/auth'
import { isSameOrigin } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/observability'

export const runtime = 'nodejs'
export const maxDuration = 30

const TagsResponseSchema = z.object({ tags: z.array(z.string()) })

/** M3: all unique tags on the authenticated owner's live notes. Archived notes are
 *  retired from the brain, so their tags must not surface as 0-count chips
 *  in the Tag Explorer. Lightweight: reads only the tags column. */
export async function GET(request: Request) {
  return observeApiRoute(request, 'tags.list', async () => {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const auth = await getAuthenticatedContext()
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { data, error } = await auth.supabase.from('notes').select('tags').neq('status', 'archived').limit(500)
  if (error) {
    return NextResponse.json({ error: 'Could not load tags' }, { status: 500 })
  }
  const seen = new Set<string>()
  for (const row of data ?? []) {
    for (const tag of (row.tags ?? []) as string[]) seen.add(tag)
  }
  const tags = [...seen].sort((a, b) => a.localeCompare(b))
  return NextResponse.json(TagsResponseSchema.parse({ tags }))
  })
}
