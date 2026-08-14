import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { proxy } from './proxy'

vi.mock('server-only', () => ({}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  })),
}))

const mockedCreateServerClient = vi.mocked(createServerClient)

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = {
    ...originalEnv,
    PRIVATE_SUPABASE_URL: 'https://private.example.supabase.co',
    PRIVATE_SUPABASE_ANON_KEY: 'private-anon',
    PRIVATE_SUPABASE_SERVICE_ROLE_KEY: 'private-service',
    DEMO_SUPABASE_URL: 'https://demo.example.supabase.co',
    DEMO_SUPABASE_ANON_KEY: 'demo-anon',
    DEMO_SUPABASE_SERVICE_ROLE_KEY: 'demo-service',
  }
  mockedCreateServerClient.mockClear()
})

describe('deployment proxy mode boundary', () => {
  it('selects demo config for /demo and overwrites a forged private header', async () => {
    const request = new NextRequest('http://localhost/demo/api/notes', {
      headers: { 'x-notelings-app-mode': 'private' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mockedCreateServerClient).toHaveBeenCalledWith(
      'https://demo.example.supabase.co',
      'demo-anon',
      expect.objectContaining({ cookieOptions: { name: 'notelings-demo-auth' } }),
    )
    expect(response.headers.get('x-middleware-request-x-notelings-app-mode')).toBe('demo')
  })

  it('selects private config for root API and overwrites a forged demo header', async () => {
    const request = new NextRequest('http://localhost/api/notes', {
      headers: { 'x-notelings-app-mode': 'demo' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mockedCreateServerClient).toHaveBeenCalledWith(
      'https://private.example.supabase.co',
      'private-anon',
      expect.objectContaining({ cookieOptions: { name: 'notelings-private-auth' } }),
    )
    expect(response.headers.get('x-middleware-request-x-notelings-app-mode')).toBe('private')
  })
})
