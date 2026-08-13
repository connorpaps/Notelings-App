import { describe, expect, it, vi } from 'vitest'
import { POST as categorize } from './categorize/route'
import { POST as chat } from './chat/route'
import { GET as tags } from './tags/route'
import { PATCH as patchNote, DELETE as deleteNote } from './notes/[id]/route'
import { getAuthenticatedContext } from '@/lib/supabase/auth'

// Route handlers are server-only in Next; Vitest needs a harmless test stub
// because this unit suite imports handlers directly in a Node test context.
vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/auth', () => ({
  getAuthenticatedContext: vi.fn(),
}))

vi.mock('@/lib/apiGuard', () => ({
  isSameOrigin: vi.fn(() => true),
  isStrictSameOrigin: vi.fn(() => true),
  CATEGORIZE_RATE_LIMIT: { windowMs: 60_000, max: 30 },
  CHAT_RATE_LIMIT: { windowMs: 60_000, max: 20 },
  rateLimit: vi.fn(() => true),
  readJsonBody: vi.fn((request: Request) => request.json()),
  RequestBodyError: class extends Error {},
}))

const mockedGetAuthenticatedContext = vi.mocked(getAuthenticatedContext)

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('authenticated API route boundary', () => {
  it('rejects signed-out categorization, chat, and tags requests', async () => {
    mockedGetAuthenticatedContext.mockResolvedValue(null)
    const categorizeResponse = await categorize(request({ content: 'private' }))
    expect(categorizeResponse.status).toBe(401)
    expect(categorizeResponse.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9-]{20,}$/)
    expect((await chat(request({ messages: [{ role: 'user', content: 'private' }] }))).status).toBe(401)
    expect((await tags(new Request('http://localhost:3000/api/tags', { headers: { host: 'localhost:3000' } }))).status).toBe(401)
  })

  it('rejects signed-out patch and delete requests', async () => {
    mockedGetAuthenticatedContext.mockResolvedValue(null)
    const context = { params: Promise.resolve({ id: 'note-1' }) }
    expect((await patchNote(request({ status: 'filed' }), context)).status).toBe(401)
    expect((await deleteNote(new Request('http://localhost:3000/api/notes/note-1', { method: 'DELETE', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' } }), context)).status).toBe(401)
  })
})
