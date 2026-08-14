import 'server-only'

import { createUserSupabase } from './server'
import { modeFromRequest, type AuthenticatedContext } from '@/lib/deployment/serverConfig'

/**
 * Verify the access token with Supabase Auth before any route does data or AI
 * work. `getUser()` performs a server-verified lookup; this is intentionally
 * not based on an unverified client claim or `getSession()` alone.
 */
export async function getAuthenticatedContext(request: Request): Promise<AuthenticatedContext | null> {
  const mode = modeFromRequest(request)
  const supabase = await createUserSupabase(mode)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { supabase, user, mode }
}
