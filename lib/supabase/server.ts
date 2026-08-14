import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { AppMode } from '@/lib/deployment/mode'
import { authCookieName, getSupabaseConfig } from '@/lib/deployment/serverConfig'

/**
 * Server-only admin client. The service-role key bypasses RLS and must remain
 * restricted to narrowly scoped trusted jobs or migration/seed operations.
 */
export function createServerSupabase(mode: AppMode = 'private') {
  const config = getSupabaseConfig(mode)
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  })
}

/**
 * Cookie-aware authenticated client for Route Handlers and Server Components.
 * The mode-specific cookie name prevents private and demo sessions from
 * overwriting one another in the same browser.
 */
export async function createUserSupabase(mode: AppMode = 'private') {
  const config = getSupabaseConfig(mode)
  const cookieStore = await cookies()
  return createServerClient(config.url, config.anonKey, {
    cookieOptions: { name: authCookieName(mode) },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot always mutate cookies. Middleware and
          // Route Handlers perform the actual refresh write when needed.
        }
      },
    },
  })
}
