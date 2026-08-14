import { NextResponse } from 'next/server'
import { z } from 'zod'
import { RegisterInputSchema } from '@/lib/auth/authSchemas'
import { isValidUsername, normalizeEmail, normalizeUsername } from '@/lib/auth/credentials'
import { AUTH_REGISTER_RATE_LIMIT, isStrictSameOrigin, rateLimit, readJsonBody, RequestBodyError } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/observability'
import { createServerSupabase, createUserSupabase } from '@/lib/supabase/server'
import { modeFromRequest } from '@/lib/deployment/serverConfig'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Signup: username + email + password. The account is created confirmed
 * (`email_confirm: true`) so the user is not forced through an email
 * verification step; password hashing and session handling stay on Supabase's
 * native path. The username row is inserted under a unique lower(username)
 * index, and the route auto-signs the user in so there is no second form.
 */
export async function POST(request: Request) {
  return observeApiRoute(request, 'auth.register', async () => {
    if (!isStrictSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!rateLimit(request, { ...AUTH_REGISTER_RATE_LIMIT, scope: 'auth.register' })) {
      return NextResponse.json(
        { error: 'Too many sign-up attempts. Try again in a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }

    let username: string
    let email: string
    let password: string
    try {
      const input = RegisterInputSchema.parse(await readJsonBody(request))
      username = normalizeUsername(input.username)
      email = normalizeEmail(input.email)
      password = input.password
    } catch (error) {
      const status = error instanceof RequestBodyError ? error.status : 400
      if (status === 413) return NextResponse.json({ error: 'Request body is too large' }, { status: 413 })
      const message = error instanceof z.ZodError ? error.issues[0]?.message : 'Check your username, email, and password.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (!isValidUsername(username)) {
      return NextResponse.json({ error: 'Use only letters, numbers, dashes, and underscores.' }, { status: 400 })
    }

    const mode = modeFromRequest(request)
    const admin = createServerSupabase(mode)

    // Username availability (unique lower index is the final authority).
    const { data: taken } = await admin.from('usernames').select('user_id').eq('username', username).maybeSingle()
    if (taken) return NextResponse.json({ error: 'That username is taken.' }, { status: 409 })

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    })
    if (createError) {
      if (/already.*regist|regist.*already/i.test(createError.message)) {
        return NextResponse.json({ error: 'An account with that email already exists. Sign in instead.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Could not create the account. Try again.' }, { status: 500 })
    }
    const user = created.user

    const { error: usernameError } = await admin.from('usernames').insert({ user_id: user.id, username })
    if (usernameError) {
      // Best-effort rollback so a taken username cannot leave an orphaned user.
      await admin.auth.admin.deleteUser(user.id).catch(() => undefined)
      return NextResponse.json({ error: 'That username is taken.' }, { status: 409 })
    }

    // Auto sign-in: establish the session cookies immediately.
    const supabase = await createUserSupabase(mode)
    const { error: sessionError } = await supabase.auth.signInWithPassword({ email, password })
    if (sessionError) {
      // Account exists; the user can sign in from the login form.
      return NextResponse.json({ ok: true, session: false, username })
    }
    return NextResponse.json({ ok: true, session: true, username })
  })
}
