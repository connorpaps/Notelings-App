import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { getAuthenticatedContext } from '@/lib/supabase/auth'

vi.mock('@/lib/supabase/auth', () => ({
  getAuthenticatedContext: vi.fn(),
}))

vi.mock('@/lib/apiGuard', () => ({
  isSameOrigin: vi.fn(() => true),
  isStrictSameOrigin: vi.fn(() => true),
  readJsonBody: vi.fn((request: Request) => request.json()),
  RequestBodyError: class extends Error {},
}))

const mockedGetAuthenticatedContext = vi.mocked(getAuthenticatedContext)

function request(body?: unknown): Request {
  return new Request('http://localhost:3000/api/notes', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('notes route authentication boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects signed-out reads before querying Supabase', async () => {
    mockedGetAuthenticatedContext.mockResolvedValue(null)
    const response = await GET(request())
    expect(response.status).toBe(401)
  })

  it('rejects signed-out manual capture before inserting', async () => {
    mockedGetAuthenticatedContext.mockResolvedValue(null)
    const response = await POST(request({ content: 'private thought', tags: ['personal'] }))
    expect(response.status).toBe(401)
  })

  it('binds manual capture to the verified user instead of request input', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'n1', category: 'Manual', tags: ['personal'] }, error: null })
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }))
    const supabase = { from: vi.fn(() => ({ insert })) }
    mockedGetAuthenticatedContext.mockResolvedValue({
      user: { id: 'user-1' } as never,
      supabase: supabase as never,
    })

    const response = await POST(request({ content: 'private thought', tags: ['personal'] }))
    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      content: 'private thought',
      category: 'Manual',
      tags: ['personal'],
      status: 'pending',
    })
  })

  it('rejects a client-supplied category so the server owns Manual state', async () => {
    mockedGetAuthenticatedContext.mockResolvedValue({ user: { id: 'user-1' } as never, supabase: {} as never })
    const response = await POST(request({ content: 'private thought', category: 'Work', tags: [] }))
    expect(response.status).toBe(400)
  })
})
