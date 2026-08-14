import { NextResponse } from 'next/server'
import { AUTH_DEMO_RATE_LIMIT, isStrictSameOrigin, rateLimit } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/observability'
import { createUserSupabase } from '@/lib/supabase/server'
import { modeFromRequest } from '@/lib/deployment/serverConfig'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * One-click entry to the shared demo workspace. The demo account password
 * lives only in server env (`NOTELINGS_DEMO_PASSWORD`) and is never sent to
 * the browser; this route signs the cookie session in directly, so demo mode
 * exercises the exact same authenticated stack as a private workspace.
 */
export async function POST(request: Request) {
  return observeApiRoute(request, 'auth.demo', async () => {
    if (!isStrictSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const mode = modeFromRequest(request)
    if (mode !== 'demo') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!rateLimit(request, { ...AUTH_DEMO_RATE_LIMIT, scope: 'auth.demo' })) {
      return NextResponse.json(
        { error: 'Too many demo entries. Try again in a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }

    const email = process.env.NOTELINGS_DEMO_EMAIL ?? 'demo@notelings.local'
    const password = process.env.NOTELINGS_DEMO_PASSWORD
    if (!password) {
      return NextResponse.json({ error: 'Demo workspace is not configured on this deployment.' }, { status: 503 })
    }

    const supabase = await createUserSupabase(mode)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json({ error: 'Demo workspace is unavailable right now.' }, { status: 503 })
    }
    return NextResponse.json({ ok: true, demo: true })
  })
}
