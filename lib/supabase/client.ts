'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authCookieNameForMode, browserMode, type AppMode } from '@/lib/deployment/mode'

const browserClients = new Map<AppMode, SupabaseClient>()

function browserConfig(mode: AppMode): { url: string; anonKey: string } {
  if (mode === 'demo') {
    const url = process.env.NEXT_PUBLIC_DEMO_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_DEMO_SUPABASE_ANON_KEY
    if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_DEMO_SUPABASE_URL or NEXT_PUBLIC_DEMO_SUPABASE_ANON_KEY')
    return { url, anonKey }
  }

  const url = process.env.NEXT_PUBLIC_PRIVATE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_PRIVATE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Missing private Supabase browser environment variables')
  return { url, anonKey }
}

/**
 * Browser client for Auth and owner-scoped Realtime. The singleton is keyed by
 * path-derived mode so a demo tab can never reuse the private Supabase client.
 */
export function createBrowserSupabase(mode: AppMode = browserMode()): SupabaseClient {
  const existing = browserClients.get(mode)
  if (existing) return existing

  const config = browserConfig(mode)
  const client = createBrowserClient(config.url, config.anonKey, {
    cookieOptions: { name: authCookieNameForMode(mode) },
  })
  browserClients.set(mode, client)
  return client
}

/**
 * Drop a client after a server-side auth mutation. The next read must parse
 * the freshly written mode-specific cookie instead of reusing a pre-auth
 * client/session snapshot.
 */
export function resetBrowserSupabase(mode: AppMode = browserMode()): void {
  browserClients.delete(mode)
}
