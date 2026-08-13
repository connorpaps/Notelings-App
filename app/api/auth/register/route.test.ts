import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { createServerSupabase, createUserSupabase } from '@/lib/supabase/server'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
  createUserSupabase: vi.fn(),
}))

vi.mock('@/lib/apiGuard', () => ({
  isStrictSameOrigin: vi.fn(() => true),
  rateLimit: vi.fn(() => true),
  AUTH_REGISTER_RATE_LIMIT: { windowMs: 60_000, max: 5 },
  readJsonBody: vi.fn((request: Request) => request.json()),
  RequestBodyError: class extends Error {
    constructor(message: string, readonly status: 400 | 413) {
      super(message)
    }
  },
}))

const mockedCreateServerSupabase = vi.mocked(createServerSupabase)
const mockedCreateUserSupabase = vi.mocked(createUserSupabase)

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

type AdminStub = {
  from: ReturnType<typeof vi.fn>
  createUser: ReturnType<typeof vi.fn>
  deleteUser: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
}

/** Service-role stub: username lookup chain + usernames insert, admin API. */
function adminStub(overrides: Partial<AdminStub> = {}): AdminStub {
  const from = overrides.from ?? vi.fn(() => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) })),
      insert,
    }
  })
  const createUser = overrides.createUser ?? vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  const deleteUser = overrides.deleteUser ?? vi.fn().mockResolvedValue({ error: null })
  mockedCreateServerSupabase.mockReturnValue({
    from,
    auth: { admin: { createUser, deleteUser } },
  } as never)
  return { from, createUser, deleteUser, insert: vi.fn() }
}

/** Capture the chain returned by the LAST from() call (the usernames insert). */
function lastInsertedBy(from: ReturnType<typeof vi.fn>): unknown {
  const chain = from.mock.results.at(-1)?.value
  return chain?.insert
}

describe('POST /api/auth/register', () => {
  let supabaseStub: { auth: { signInWithPassword: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    vi.clearAllMocks()
    adminStub()
    supabaseStub = { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) } }
    mockedCreateUserSupabase.mockResolvedValue(supabaseStub as never)
  })

  it('rejects short passwords with a readable message', async () => {
    const response = await POST(request({ username: 'bob', email: 'bob@example.com', password: 'short' }))
    expect(response.status).toBe(400)
    expect((await response.json() as { error: string }).error).toContain('10 characters')
  })

  it('rejects an invalid username', async () => {
    const response = await POST(request({ username: 'has space', email: 'bob@example.com', password: 'x'.repeat(12) }))
    expect(response.status).toBe(400)
  })

  it('rejects a taken username before creating the user', async () => {
    const stub = adminStub({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'someone' }, error: null }) })) })),
        insert: vi.fn(),
      })),
    })
    const response = await POST(request({ username: 'bob', email: 'bob@example.com', password: 'x'.repeat(12) }))
    expect(response.status).toBe(409)
    expect(stub.createUser).not.toHaveBeenCalled()
  })

  it('normalizes username and email before creating the user', async () => {
    const stub = adminStub()
    const response = await POST(request({ username: '  Bob_42 ', email: ' Bob@Example.com ', password: 'x'.repeat(12) }))
    expect(response.status).toBe(200)
    expect(stub.createUser).toHaveBeenCalledWith({
      email: 'bob@example.com',
      password: 'x'.repeat(12),
      email_confirm: true,
      user_metadata: { username: 'bob_42' },
    })
    const insert = lastInsertedBy(stub.from)
    expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', username: 'bob_42' })
  })

  it('returns 409 when the email already belongs to an account', async () => {
    adminStub({
      createUser: vi.fn().mockResolvedValue({ data: null, error: new Error('User already registered') }),
    })
    const response = await POST(request({ username: 'bob', email: 'bob@example.com', password: 'x'.repeat(12) }))
    expect(response.status).toBe(409)
    expect((await response.json() as { error: string }).error).toContain('already exists')
  })

  it('auto-signs the new user in', async () => {
    const response = await POST(request({ username: 'bob', email: 'bob@example.com', password: 'x'.repeat(12) }))
    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean; session: boolean; username: string }
    expect(json).toMatchObject({ ok: true, session: true, username: 'bob' })
    expect(supabaseStub.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'bob@example.com', password: 'x'.repeat(12) })
  })
})
