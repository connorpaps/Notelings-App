import { NextResponse } from 'next/server'
import { LoginInputSchema } from '@/lib/auth/authSchemas'
import { resolveEmailForLogin } from '@/lib/auth/resolve'
import { AUTH_LOGIN_RATE_LIMIT, isStrictSameOrigin, rateLimit, readJsonBody, RequestBodyError } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/observability'
import { createUserSupabase } from '@/lib/supabase/server'
import { modeFromRequest } from '@/lib/deployment/serverConfig'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Password sign-in with a username OR email. The session is established with
 * the cookie-aware SSR client so the httpOnly-ish session cookies land on the
 * response and the existing proxy.ts refresh path keeps them alive. Failures
 * always return the same generic message to avoid account enumeration.
 */
export async function POST(request: Request) {
  return observeApiRoute(request, 'auth.login', async () => {
    if (!isStrictSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!rateLimit(request, { ...AUTH_LOGIN_RATE_LIMIT, scope: 'auth.login' })) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Try again in a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }

    let identifier: string
    let password: string
    try {
      const input = LoginInputSchema.parse(await readJsonBody(request))
      identifier = input.identifier
      password = input.password
    } catch (error) {
      const status = error instanceof RequestBodyError ? error.status : 400
      if (status === 413) return NextResponse.json({ error: 'Request body is too large' }, { status: 413 })
      return NextResponse.json({ error: 'Enter your username or email and password.' }, { status: 400 })
    }

    const mode = modeFromRequest(request)
    const email = await resolveEmailForLogin(identifier, mode)
    if (!email) {
      // Unknown identifier — same message as a wrong password.
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    const supabase = await createUserSupabase(mode)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }
    return NextResponse.json({ ok: true })
  })
}
