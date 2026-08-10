'use client'

import { createClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client (anon key) — used ONLY for the Realtime channel
 * subscription in useNotesRealtime. All DB writes go through server routes
 * with the service-role key (lib/supabase/server.ts); the anon key must never
 * perform writes.
 */
export function createBrowserSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase browser environment variables')
  }
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
}
