import { NextResponse } from 'next/server'
import { CategorizeResponseSchema, NoteInputSchema } from '@/lib/notes/categorization'
import { categorizeNote } from '@/lib/notes/categorizeNote'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  let input: { content: string }
  try {
    input = NoteInputSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid note: must be 1-1000 characters' }, { status: 400 })
  }

  let category: 'Work' | 'Admin' | 'Uncategorized' = 'Uncategorized'
  let tags: string[] = []
  let degraded = false
  try {
    const result = await categorizeNote(input.content)
    category = result.category
    tags = result.tags
  } catch (error) {
    // MASTER_SPEC_FINAL §6 fallback: 10s timeout or API failure → save as
    // Uncategorized so the user still gets persistence + a dispatched agent.
    console.error('LLM categorization failed, degrading to Uncategorized:', error)
    degraded = true
  }

  const { data, error } = await createServerSupabase()
    .from('notes')
    .insert({ content: input.content, category, tags, status: degraded ? 'pending' : 'categorized' })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Could not save the note' }, { status: 500 })
  }

  return NextResponse.json(CategorizeResponseSchema.parse({ id: data.id, category, tags, degraded }))
}
