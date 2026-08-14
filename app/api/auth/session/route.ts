import { NextResponse } from 'next/server'
import { isSameOrigin } from '@/lib/apiGuard'
import { getAuthenticatedContext } from '@/lib/supabase/auth'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Return only the verified user object; access and refresh tokens stay in cookies. */
export async function GET(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const auth = await getAuthenticatedContext(request)
    return NextResponse.json({ user: auth?.user ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Session verification is unavailable right now.' }, { status: 503 })
  }
}
