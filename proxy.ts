import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { APP_MODE_HEADER, DEMO_PATH_PREFIX, modeFromPathname } from '@/lib/deployment/mode'
import { authCookieName, getSupabaseConfig } from '@/lib/deployment/serverConfig'

/**
 * Refreshes the mode-specific Supabase SSR session before Server Components
 * and Route Handlers run. The internal mode header is overwritten here, so a
 * browser cannot select a project by sending its own header or query value.
 */
export async function proxy(request: NextRequest) {
  const mode = modeFromPathname(request.nextUrl.pathname)
  let config: ReturnType<typeof getSupabaseConfig>
  try {
    config = getSupabaseConfig(mode)
  } catch {
    return NextResponse.next({ request })
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(APP_MODE_HEADER, mode)
  const isDemoApi = request.nextUrl.pathname === `${DEMO_PATH_PREFIX}/api`
    || request.nextUrl.pathname.startsWith(`${DEMO_PATH_PREFIX}/api/`)
  const isDemoCallback = request.nextUrl.pathname === `${DEMO_PATH_PREFIX}/auth/callback`
  const rewriteTarget = isDemoApi
    ? `/api${request.nextUrl.pathname.slice(`${DEMO_PATH_PREFIX}/api`.length) || '/'}`
    : isDemoCallback
      ? `/auth/callback${request.nextUrl.search}`
      : null
  const responseFor = () => {
    const init = { request: { headers: requestHeaders } }
    return rewriteTarget === null
      ? NextResponse.next(init)
      : NextResponse.rewrite(new URL(rewriteTarget, request.url), init)
  }

  let response = responseFor()
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: { name: authCookieName(mode) },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = responseFor()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|glb)$).*)'],
}
