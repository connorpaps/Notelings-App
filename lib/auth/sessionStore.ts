'use client'

import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

/**
 * Shared browser session mirror. Multiple components call useAuthSession()
 * (header AuthControls, welcome card, dock, realtime hook); without a shared
 * store, a server-side sign-in that refreshes one instance leaves the others
 * showing signed-out (Supabase's onAuthStateChange does not fire for cookies
 * written by server routes). The cookies remain the source of truth; this is
 * only the in-memory mirror that makes every instance re-render together.
 */
type AuthSessionState = {
  user: User | null
  setUser: (user: User | null) => void
}

export const useAuthSessionStore = create<AuthSessionState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
