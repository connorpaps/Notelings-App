'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { useAuthSessionStore } from '@/lib/auth/sessionStore'

const E2E_AUTH_BYPASS =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS === '1'

/** Shared session state for the header and private action surfaces. */
export function useAuthSession() {
  const user = useAuthSessionStore((state) => state.user)
  const setStoreUser = useAuthSessionStore((state) => state.setUser)
  const [loading, setLoading] = useState(!E2E_AUTH_BYPASS)

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

    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (disposed) return
        setStoreUser(data.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (disposed) return
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
    try {
      const { data } = await createBrowserSupabase().auth.getUser()
      const nextUser = data.user ?? null
      setStoreUser(nextUser)
      return Boolean(nextUser)
    } catch {
      setStoreUser(null)
      return false
    } finally {
      setLoading(false)
    }
  }, [setStoreUser])

  return {
    user,
    loading,
    authenticated: E2E_AUTH_BYPASS || Boolean(user),
    refresh,
  }
}
