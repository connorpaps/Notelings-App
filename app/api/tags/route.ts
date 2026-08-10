import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const TagsResponseSchema = z.object({ tags: z.array(z.string()) })

/** M3: all unique tags on live notes (service role). Archived notes are
 *  retired from the brain, so their tags must not surface as 0-count chips
 *  in the Tag Explorer. Lightweight: reads only the tags column. */
export async function GET() {
  const { data, error } = await createServerSupabase().from('notes').select('tags').neq('status', 'archived')
  if (error) {
    return NextResponse.json({ error: 'Could not load tags' }, { status: 500 })
  }
  const seen = new Set<string>()
  for (const row of data ?? []) {
    for (const tag of (row.tags ?? []) as string[]) seen.add(tag)
  }
  const tags = [...seen].sort((a, b) => a.localeCompare(b))
  return NextResponse.json(TagsResponseSchema.parse({ tags }))
}
