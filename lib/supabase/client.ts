'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Browser client for Auth and owner-scoped Realtime. Uses @supabase/ssr's
 * cookie-backed storage so the browser session matches the server session
 * established by the auth routes (no localStorage/session split-brain):
 * after POST /api/auth/login|register|demo writes the session cookies, the
 * client's getUser() sees the same session. Database writes still go through
 * authenticated server routes and RLS remains the source of truth.
 */
export function createBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase browser environment variables')
  }
  browserClient = createBrowserClient(supabaseUrl, anonKey)
  return browserClient
}
