import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { getSupabaseConfig, modeFromRequest } from './serverConfig'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('server deployment configuration', () => {
  it('selects explicit demo credentials only for demo mode', () => {
    process.env.DEMO_SUPABASE_URL = 'https://demo.example.supabase.co'
    process.env.DEMO_SUPABASE_ANON_KEY = 'demo-anon'
    process.env.DEMO_SUPABASE_SERVICE_ROLE_KEY = 'demo-service'

    expect(getSupabaseConfig('demo')).toEqual({
      url: 'https://demo.example.supabase.co',
      anonKey: 'demo-anon',
      serviceRoleKey: 'demo-service',
    })
  })

  it('keeps private compatibility fallback separate from demo config', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://private.example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'private-anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'private-service'
    delete process.env.DEMO_SUPABASE_URL
    delete process.env.DEMO_SUPABASE_ANON_KEY
    delete process.env.DEMO_SUPABASE_SERVICE_ROLE_KEY

    expect(getSupabaseConfig('private')).toEqual({
      url: 'https://private.example.supabase.co',
      anonKey: 'private-anon',
      serviceRoleKey: 'private-service',
    })
    expect(() => getSupabaseConfig('demo')).toThrow('Missing DEMO_SUPABASE_URL')
  })

  it('uses only the proxy-written mode header', () => {
    expect(modeFromRequest(new Request('http://localhost/api/notes'))).toBe('private')
    expect(modeFromRequest(new Request('http://localhost/api/notes', { headers: { 'x-notelings-app-mode': 'demo' } }))).toBe('demo')
    expect(modeFromRequest(new Request('http://localhost/api/notes', { headers: { 'x-notelings-app-mode': 'other' } }))).toBe('private')
  })
})
