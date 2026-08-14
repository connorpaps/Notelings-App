import { NextResponse } from 'next/server'
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { ChatRequestSchema, normalizeChatMessages, type ChatRequest } from '@/lib/notes/chatApi'
import { buildLibrarianSystemPrompt } from '@/lib/notes/chatContext'
import { buildCitationIndex, invertCitationIndex } from '@/lib/notes/citations'
import { countNotesMatching, detectCountQuery } from '@/lib/notes/countIntent'
import { retrieveRelevantNotes } from '@/lib/notes/embeddingRetrieval'
import { createUiMessageStreamResponse } from '@/lib/notes/uiMessageStream'
import { NotesListSchema } from '@/lib/notes/notesApi'
import type { NoteRecord } from '@/lib/notes/types'
import { getAuthenticatedContext } from '@/lib/supabase/auth'
import { CHAT_RATE_LIMIT, isStrictSameOrigin, readJsonBody, RequestBodyError, rateLimit } from '@/lib/apiGuard'
import { logApiFailure, observeApiRoute } from '@/lib/observability'
import { reserveDemoAiUsage } from '@/lib/ai/demoUsage'

export const runtime = 'nodejs'
export const maxDuration = 60

const CHAT_LLM_TIMEOUT_MS = 25_000
/** ≤ this many notes: all (newest-first) go into context. Above: embedding retrieval. */
const CHAT_NOTE_CONTEXT_LIMIT = 150
/** How many notes embedding retrieval keeps for the context. */
const CHAT_RETRIEVAL_K = 60
/** Prune the conversation to the most recent messages (useChat resends history). */
const CHAT_HISTORY_LIMIT = 20
/** Citation list cap in deterministic count answers (avoids huge replies). */
const COUNT_CITATION_CAP = 12

/**
 * M4: "Ask the Librarian" — strictly-grounded RAG over the user's notes.
 *  - temperature 0 + maxRetries 0 + the refusal system prompt = no hallucination.
 *  - Count questions are answered deterministically in code (no LLM call).
 *  - ≤150 notes: newest-first context. >150: Gemini embedding retrieval top-K.
 *  - Archived notes are retired from the brain and excluded.
 */
export async function POST(request: Request) {
  return observeApiRoute(request, 'chat', async ({ requestId }) => {
  if (!isStrictSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!rateLimit(request, { ...CHAT_RATE_LIMIT, scope: 'chat' })) {
    return NextResponse.json(
      { error: 'Too many requests, please slow down' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  const auth = await getAuthenticatedContext(request)
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let input: ChatRequest
  try {
    input = ChatRequestSchema.parse(await readJsonBody(request))
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400
    const message = error instanceof RequestBodyError ? error.message : 'Invalid chat request'
    return NextResponse.json({ error: message }, { status })
  }

  const messages = normalizeChatMessages(input.messages).slice(-CHAT_HISTORY_LIMIT)
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
  if (!lastUser) {
    return NextResponse.json({ error: 'A user message is required' }, { status: 400 })
  }

  let allNotes: NoteRecord[]
  try {
    const { data, error } = await auth.supabase
      .from('notes')
      .select('id, content, category, tags, status, created_at')
      .neq('status', 'archived')
      // Same ordering the client uses for its citation index (id tiebreak).
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(500)
    if (error) throw new Error(error.message)
    const parsed = NotesListSchema.safeParse(data)
    if (!parsed.success) throw new Error('Invalid notes payload')
    allNotes = parsed.data
  } catch (error) {
    logApiFailure('chat', request, error, requestId)
    return NextResponse.json({ error: 'Could not load notes' }, { status: 500 })
  }

  // Global citation numbers shared with the client (same for every mode).
  const numberById = invertCitationIndex(buildCitationIndex(allNotes))

  // Deterministic counting path — exact, instant, no LLM call.
  const countTopic = detectCountQuery(lastUser.content)
  if (countTopic) {
    const matches = countNotesMatching(allNotes, countTopic)
    let answer: string
    if (matches.length === 0) {
      answer = `I couldn't find any notes related to "${countTopic}".`
    } else {
      const cites = matches
        .slice(0, COUNT_CITATION_CAP)
        .map((note) => `[${numberById.get(note.id) ?? '?'}]`)
        .join(', ')
      const extra = matches.length > COUNT_CITATION_CAP ? ` and ${matches.length - COUNT_CITATION_CAP} more` : ''
      answer = `${matches.length} of your notes match "${countTopic}": ${cites}${extra}.`
    }
    return createUiMessageStreamResponse(answer)
  }

  const aiBudgetAvailable = await reserveDemoAiUsage('chat', auth.mode)
  if (!aiBudgetAvailable) {
    return createUiMessageStreamResponse(
      'The demo AI limit has been reached for today. You can still capture notes manually, and the demo will reset its sample workspace separately.',
    )
  }

  // LLM path: all notes if within the context limit, else embedding retrieval.
  let contextNotes: NoteRecord[]
  if (allNotes.length <= CHAT_NOTE_CONTEXT_LIMIT) {
    contextNotes = allNotes
  } else {
    try {
      contextNotes = await retrieveRelevantNotes(allNotes, lastUser.content, CHAT_RETRIEVAL_K)
    } catch (error) {
      logApiFailure('chat', request, error, requestId)
      contextNotes = allNotes.slice(0, CHAT_NOTE_CONTEXT_LIMIT)
    }
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: buildLibrarianSystemPrompt(contextNotes, numberById),
    messages,
    temperature: 0,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(CHAT_LLM_TIMEOUT_MS),
  })

  return result.toUIMessageStreamResponse()
  })
}
