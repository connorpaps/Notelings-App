import { NextResponse } from 'next/server'
import { isStrictSameOrigin } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/observability'
import { createUserSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Server-side sign-out: clears the session cookies on the response. */
export async function POST(request: Request) {
  return observeApiRoute(request, 'auth.logout', async () => {
    if (!isStrictSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const supabase = await createUserSupabase()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  })
}
