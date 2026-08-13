import 'server-only'

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createUserSupabase } from './server'

type AuthenticatedContext = {
  supabase: SupabaseClient
  user: User
}

/**
 * Verify the access token with Supabase Auth before any route does data or AI
 * work. `getUser()` performs a server-verified lookup; this is intentionally
 * not based on an unverified client claim or `getSession()` alone.
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  const supabase = await createUserSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { supabase, user }
}
