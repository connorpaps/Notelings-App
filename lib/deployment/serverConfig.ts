import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppMode } from './mode'
import { APP_MODE_HEADER } from './mode'

type SupabaseConfig = {
  url: string
  anonKey: string
  serviceRoleKey: string
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

export function getSupabaseConfig(mode: AppMode): SupabaseConfig {
  if (mode === 'demo') {
    return {
      url: required('DEMO_SUPABASE_URL'),
      anonKey: required('DEMO_SUPABASE_ANON_KEY'),
      serviceRoleKey: required('DEMO_SUPABASE_SERVICE_ROLE_KEY'),
    }
  }

  return {
    url: process.env.PRIVATE_SUPABASE_URL || required('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: process.env.PRIVATE_SUPABASE_ANON_KEY || required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY || required('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

export function authCookieName(mode: AppMode): string {
  return mode === 'demo' ? 'notelings-demo-auth' : 'notelings-private-auth'
}

export function modeFromRequest(request: Request): AppMode {
  return request.headers.get(APP_MODE_HEADER) === 'demo' ? 'demo' : 'private'
}

export type AuthenticatedContext = {
  supabase: SupabaseClient
  user: import('@supabase/supabase-js').User
  mode: AppMode
}
