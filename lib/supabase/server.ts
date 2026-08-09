import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Server-only module: `server-only` turns any accidental client import into a
 * build error. The service-role key must NEVER be imported from a client
 * component. Route handlers and server utilities only.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function createServerSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables')
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}
