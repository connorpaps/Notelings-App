import { NextResponse } from 'next/server'
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { ChatRequestSchema, normalizeChatMessages, type ChatRequest } from '@/lib/notes/chatApi'
import { buildLibrarianSystemPrompt } from '@/lib/notes/chatContext'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const CHAT_LLM_TIMEOUT_MS = 25_000
const CHAT_NOTE_LIMIT = 150
/** Prune the conversation to the most recent messages (useChat resends history). */
const CHAT_HISTORY_LIMIT = 20

/**
 * M4: "Ask the Librarian" — strictly-grounded RAG over the user's notes.
 * temperature 0 + maxRetries 0 + the refusal system prompt = no hallucination.
 * Archived notes are retired from the brain and excluded from context.
 */
export async function POST(request: Request) {
  let input: ChatRequest
  try {
    input = ChatRequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid chat request' }, { status: 400 })
  }

  let notes
  try {
    const { data, error } = await createServerSupabase()
      .from('notes')
      .select('id, content, category, tags, status, created_at')
      .in('status', ['pending', 'in_transit', 'filed'])
      .order('created_at', { ascending: false })
      .limit(CHAT_NOTE_LIMIT)
    if (error) throw new Error(error.message)
    notes = data ?? []
  } catch (error) {
    console.error('Librarian: could not load notes:', error)
    return NextResponse.json({ error: 'Could not load notes' }, { status: 500 })
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: buildLibrarianSystemPrompt(notes),
    messages: normalizeChatMessages(input.messages).slice(-CHAT_HISTORY_LIMIT),
    temperature: 0,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(CHAT_LLM_TIMEOUT_MS),
  })

  return result.toUIMessageStreamResponse()
}
