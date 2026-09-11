'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { browserApiPath } from '@/lib/deployment/mode'
import { useAuthSessionStore } from '@/lib/auth/sessionStore'

const E2E_AUTH_BYPASS =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS === '1'

/** Shared session state for the header and private action surfaces. */
export function useAuthSession() {
  const user = useAuthSessionStore((state) => state.user)
  const setStoreUser = useAuthSessionStore((state) => state.setUser)
  const [loading, setLoading] = useState(!E2E_AUTH_BYPASS)
  const sessionReadVersion = useRef(0)

  useEffect(() => {
    if (E2E_AUTH_BYPASS) return
    let disposed = false
    let supabase: ReturnType<typeof createBrowserSupabase>

    try {
      supabase = createBrowserSupabase()
    } catch {
      // A deployment with incomplete public Supabase config should leave the
      // access card usable instead of throwing through the app error boundary.
      queueMicrotask(() => {
        if (disposed) return
        setStoreUser(null)
        setLoading(false)
      })
      return undefined
    }

    const initialReadVersion = sessionReadVersion.current
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (disposed) return
        if (initialReadVersion !== sessionReadVersion.current) return
        setStoreUser(data.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (disposed || initialReadVersion !== sessionReadVersion.current) return
        setStoreUser(null)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (disposed) return
      setStoreUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      disposed = true
      subscription.unsubscribe()
    }
  }, [setStoreUser])

  /** Re-read the session from cookies after a server-side sign-in/sign-out. */
  const refresh = useCallback(async (): Promise<boolean> => {
    if (E2E_AUTH_BYPASS) return true
    sessionReadVersion.current += 1
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(browserApiPath('/auth/session'), { cache: 'no-store' })
        if (response.ok) {
          const payload = (await response.json()) as { user?: ReturnType<typeof useAuthSessionStore.getState>['user'] }
          const nextUser = payload.user ?? null
          if (nextUser) {
            setStoreUser(nextUser)
            setLoading(false)
            return true
          }
        }
      } catch {
        // Retry once the server-side auth cookie has propagated to the route.
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 180))
    }
    setStoreUser(null)
    setLoading(false)
    return false
  }, [setStoreUser])

  return {
    user,
    loading,
    authenticated: E2E_AUTH_BYPASS || Boolean(user),
    refresh,
  }
}
