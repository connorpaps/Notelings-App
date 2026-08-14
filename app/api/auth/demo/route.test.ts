import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { createUserSupabase } from '@/lib/supabase/server'
import { APP_MODE_HEADER } from '@/lib/deployment/mode'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
  createUserSupabase: vi.fn(),
}))

vi.mock('@/lib/apiGuard', () => ({
  isStrictSameOrigin: vi.fn(() => true),
  rateLimit: vi.fn(() => true),
  AUTH_DEMO_RATE_LIMIT: { windowMs: 60_000, max: 10 },
  readJsonBody: vi.fn((request: Request) => request.json()),
  RequestBodyError: class extends Error {
    constructor(message: string, readonly status: 400 | 413) {
      super(message)
    }
  },
}))

const mockedCreateUserSupabase = vi.mocked(createUserSupabase)

function request(): Request {
  return new Request('http://localhost:3000/api/auth/demo', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', [APP_MODE_HEADER]: 'demo' },
  })
}

describe('POST /api/auth/demo', () => {
  const originalPassword = process.env.NOTELINGS_DEMO_PASSWORD

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.NOTELINGS_DEMO_PASSWORD
    else process.env.NOTELINGS_DEMO_PASSWORD = originalPassword
  })

  it('returns 503 when the demo account is not configured', async () => {
    delete process.env.NOTELINGS_DEMO_PASSWORD
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(mockedCreateUserSupabase).not.toHaveBeenCalled()
  })

  it('returns 503 when the demo sign-in fails', async () => {
    process.env.NOTELINGS_DEMO_PASSWORD = 'demo-password'
    mockedCreateUserSupabase.mockResolvedValue({
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: new Error('invalid credentials') }) },
    } as never)
    const response = await POST(request())
    expect(response.status).toBe(503)
  })

  it('signs into the demo account', async () => {
    process.env.NOTELINGS_DEMO_PASSWORD = 'demo-password'
    const supabaseStub = { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) } }
    mockedCreateUserSupabase.mockResolvedValue(supabaseStub as never)
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, demo: true })
    expect(supabaseStub.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'demo@notelings.local', password: 'demo-password' })
  })
})
