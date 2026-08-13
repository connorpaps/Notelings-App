import 'server-only'

import { createServerSupabase } from '@/lib/supabase/server'
import { isEmailLike, isValidUsername, normalizeEmail, normalizeUsername } from './credentials'

/**
 * Resolve a login identifier to the canonical account email:
 *  - an email-shaped identifier is used as-is (normalized);
 *  - a username is looked up in `public.usernames` (service role, bypasses
 *    RLS) and mapped to the account email via the admin API.
 * Returns null when the identifier cannot be resolved — the caller must reply
 * with the same generic error used for a wrong password (no enumeration).
 */
export async function resolveEmailForLogin(identifier: string): Promise<string | null> {
  if (isEmailLike(identifier)) return normalizeEmail(identifier)

  const username = normalizeUsername(identifier)
  if (!isValidUsername(username)) return null

  const admin = createServerSupabase()
  const { data } = await admin.from('usernames').select('user_id').eq('username', username).maybeSingle()
  if (!data?.user_id) return null

  const { data: user } = await admin.auth.admin.getUserById(data.user_id)
  return user?.user?.email ?? null
}
