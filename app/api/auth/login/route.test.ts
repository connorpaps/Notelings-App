import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { resolveEmailForLogin } from '@/lib/auth/resolve'
import { createUserSupabase } from '@/lib/supabase/server'
import { isStrictSameOrigin, rateLimit } from '@/lib/apiGuard'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth/resolve', () => ({
  resolveEmailForLogin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
  createUserSupabase: vi.fn(),
}))

vi.mock('@/lib/apiGuard', () => ({
  isStrictSameOrigin: vi.fn(() => true),
  rateLimit: vi.fn(() => true),
  AUTH_LOGIN_RATE_LIMIT: { windowMs: 60_000, max: 10 },
  readJsonBody: vi.fn((request: Request) => request.json()),
  RequestBodyError: class extends Error {
    constructor(message: string, readonly status: 400 | 413) {
      super(message)
    }
  },
}))

const mockedResolve = vi.mocked(resolveEmailForLogin)
const mockedCreateUserSupabase = vi.mocked(createUserSupabase)
const mockedStrictSameOrigin = vi.mocked(isStrictSameOrigin)
const mockedRateLimit = vi.mocked(rateLimit)

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  let supabaseStub: { auth: { signInWithPassword: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedResolve.mockResolvedValue('bob@example.com')
    mockedStrictSameOrigin.mockReturnValue(true)
    mockedRateLimit.mockReturnValue(true)
    supabaseStub = { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) } }
    mockedCreateUserSupabase.mockResolvedValue(supabaseStub as never)
  })

  it('rejects cross-origin requests', async () => {
    mockedStrictSameOrigin.mockReturnValue(false)
    const response = await POST(request({ identifier: 'bob', password: 'secret-password' }))
    expect(response.status).toBe(403)
  })

  it('rejects requests over the rate limit', async () => {
    mockedRateLimit.mockReturnValue(false)
    const response = await POST(request({ identifier: 'bob', password: 'secret-password' }))
    expect(response.status).toBe(429)
  })

  it('rejects empty bodies with 400', async () => {
    const response = await POST(request({ identifier: '', password: '' }))
    expect(response.status).toBe(400)
  })

  it('returns the generic message for an unknown identifier (no enumeration)', async () => {
    mockedResolve.mockResolvedValue(null)
    const response = await POST(request({ identifier: 'nobody', password: 'wrong-password' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid username or password.' })
    expect(mockedCreateUserSupabase).not.toHaveBeenCalled()
  })

  it('returns the generic message for a wrong password', async () => {
    supabaseStub.auth.signInWithPassword.mockResolvedValue({ error: new Error('invalid credentials') })
    const response = await POST(request({ identifier: 'bob@example.com', password: 'wrong-password' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid username or password.' })
  })

  it('signs in by email when the identifier is email-shaped', async () => {
    const response = await POST(request({ identifier: 'Bob@Example.com', password: 'secret-password' }))
    expect(response.status).toBe(200)
    expect(supabaseStub.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'bob@example.com', password: 'secret-password' })
  })

  it('attaches the correlation header', async () => {
    const response = await POST(request({ identifier: 'bob', password: 'secret-password' }))
    expect(response.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9-]{20,}$/)
  })
})
