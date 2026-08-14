'use client'

import { useState, type FormEvent } from 'react'
import { LogIn, LogOut, ShieldCheck, Sparkles, UserPlus, X } from 'lucide-react'
import { browserApiPath } from '@/lib/deployment/mode'
import GlassPanel from './GlassPanel'
import { useAuthSession } from './useAuthSession'

type AuthMode = 'signin' | 'signup'

type AuthControlsProps = {
  placement?: 'header' | 'welcome'
  onContinue?: () => void
}

/**
 * Username-or-email + password auth in two placements: a compact, high-contrast
 * header control after entry and a full-width access card in the opening hero.
 * Sign-in/sign-up run through the CSRF-guarded server routes; the session lives
 * in cookies and is re-read client-side via useAuthSession().refresh(). Demo
 * mode is a real session on the shared demo account (handled by the caller).
 */
export default function AuthControls({ placement = 'header', onContinue }: AuthControlsProps) {
  const { authenticated, loading, user, refresh } = useAuthSession()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const isDemo = Boolean(user?.user_metadata?.is_demo)
  const displayName =
    (user?.user_metadata?.username as string | undefined) ?? user?.email ?? 'Signed in'

  const resetFeedback = () => {
    setMessage(null)
    setError(null)
  }

  const runAuth = async (path: '/auth/login' | '/auth/register', body: unknown) => {
    setBusy(true)
    resetFeedback()
    try {
      const res = await fetch(browserApiPath(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const text =
          typeof json === 'object' && json !== null && 'error' in json
            ? String((json as { error: unknown }).error)
            : 'Could not complete that. Try again.'
        setError(text)
        return
      }
      await refresh()
      onContinue?.()
    } catch {
      setError('Sign-in is unavailable right now. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const signIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()
    if (!identifier.trim() || !password) {
      setError('Enter your username or email and password.')
      return
    }
    void runAuth('/auth/login', { identifier: identifier.trim(), password })
  }

  const signUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()
    void runAuth('/auth/register', { username, email, password })
  }

  const signOut = async () => {
    resetFeedback()
    try {
      await fetch(browserApiPath('/auth/logout'), { method: 'POST' })
    } catch {
      // The server route is the source of truth; a failed request still
      // re-reads the session below so the UI cannot show a stale signed-in.
    }
    await refresh()
    setOpen(false)
  }

  if (placement === 'welcome') {
    if (loading) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-white/65" role="status">
          Checking your private workspace…
        </div>
      )
    }

    if (authenticated) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-white">
            <ShieldCheck size={15} className="text-white/80" />
            {isDemo ? 'Demo workspace ready' : 'Private workspace ready'}
          </p>
          <p className="mt-1 truncate text-xs text-white/55" title={displayName}>
            {displayName}
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.01] active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Sparkles size={15} />
            Initialize Agents
          </button>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
            <ShieldCheck size={15} />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Your private workspace</p>
            <p className="mt-1 text-xs leading-relaxed text-white/65">
              Sign in with your username or email to save notes, sync your board, and ask the Librarian.
            </p>
          </div>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
        {mode === 'signin' ? (
          <form onSubmit={signIn} className="mt-3 flex flex-col gap-2" noValidate>
            <label htmlFor="welcome-auth-identifier" className="text-xs font-medium text-white/75">
              Username or email
            </label>
            <input
              id="welcome-auth-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="username or you@example.com"
              disabled={busy}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
            />
            <label htmlFor="welcome-auth-password" className="mt-1 text-xs font-medium text-white/75">
              Password
            </label>
            <input
              id="welcome-auth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
              disabled={busy}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.01] active:scale-[.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <LogIn size={15} />
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={signUp} className="mt-3 flex flex-col gap-2" noValidate>
            <label htmlFor="welcome-auth-username" className="text-xs font-medium text-white/75">
              Username
            </label>
            <input
              id="welcome-auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="3–24 letters, numbers, _ or -"
              disabled={busy}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
            />
            <label htmlFor="welcome-auth-email" className="mt-1 text-xs font-medium text-white/75">
              Email
            </label>
            <input
              id="welcome-auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
            />
            <label htmlFor="welcome-auth-new-password" className="mt-1 text-xs font-medium text-white/75">
              Password
            </label>
            <input
              id="welcome-auth-new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 10 characters"
              disabled={busy}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.01] active:scale-[.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <UserPlus size={15} />
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
        {(message || error) && (
          <p role={error ? 'alert' : 'status'} className={`mt-3 text-xs leading-relaxed ${error ? 'text-red-200' : 'text-white/80'}`}>
            {error ?? message}
          </p>
        )}
      </div>
    )
  }

  if (loading) {
    return <span className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-full bg-white/5 text-white/30" aria-label="Checking account" />
  }

  if (authenticated) {
    return (
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/10 p-1 pl-3 ring-1 ring-white/15">
        {isDemo && (
          <span className="mr-0.5 rounded-full bg-cyan-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-100">
            Demo
          </span>
        )}
        <span className="hidden max-w-32 truncate text-[11px] text-white/85 sm:inline" title={displayName}>
          {displayName}
        </span>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => void signOut()}
          className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white/75 transition hover:bg-white/25 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <LogOut size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Sign in to private workspace"
        onClick={() => {
          setOpen((value) => !value)
          resetFeedback()
          setMode('signin')
        }}
        className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black shadow-[0_1px_10px_rgba(255,255,255,0.25)] transition hover:bg-white/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <LogIn size={13} className="text-black" />
        <span className="hidden sm:inline">Sign in</span>
      </button>
      {open && (
        <GlassPanel strong className="absolute right-0 top-[calc(100%+0.75rem)] z-[70] w-[min(88vw,320px)] rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-white">
                <ShieldCheck size={13} className="text-white/80" /> Private workspace
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                {mode === 'signin' ? 'Sign in with your username or email.' : 'Create your workspace account.'}
              </p>
            </div>
            <button type="button" aria-label="Close sign-in" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-full text-white/55 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 flex gap-1 rounded-full bg-black/25 p-1">
            <button
              type="button"
              aria-pressed={mode === 'signin'}
              onClick={() => {
                setMode('signin')
                resetFeedback()
              }}
              className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-medium transition ${
                mode === 'signin' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === 'signup'}
              onClick={() => {
                setMode('signup')
                resetFeedback()
              }}
              className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-medium transition ${
                mode === 'signup' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              Create account
            </button>
          </div>
          {mode === 'signin' ? (
            <form onSubmit={signIn} className="mt-3 flex flex-col gap-2" noValidate>
              <label htmlFor="auth-identifier" className="text-[11px] font-medium text-white/70">
                Username or email
              </label>
              <input
                id="auth-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="username or you@example.com"
                disabled={busy}
                className="h-10 rounded-xl border border-white/15 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
              />
              <label htmlFor="auth-password" className="text-[11px] font-medium text-white/70">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••"
                disabled={busy}
                className="h-10 rounded-xl border border-white/15 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 active:scale-[.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={signUp} className="mt-3 flex flex-col gap-2" noValidate>
              <label htmlFor="auth-username" className="text-[11px] font-medium text-white/70">
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="3–24 letters, numbers, _ or -"
                disabled={busy}
                className="h-10 rounded-xl border border-white/15 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
              />
              <label htmlFor="auth-email" className="text-[11px] font-medium text-white/70">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={busy}
                className="h-10 rounded-xl border border-white/15 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
              />
              <label htmlFor="auth-new-password" className="text-[11px] font-medium text-white/70">
                Password
              </label>
              <input
                id="auth-new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 10 characters"
                disabled={busy}
                className="h-10 rounded-xl border border-white/15 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/15"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 active:scale-[.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
          {(message || error) && (
            <p role={error ? 'alert' : 'status'} className={`mt-3 text-[11px] leading-relaxed ${error ? 'text-red-200' : 'text-white/80'}`}>
              {error ?? message}
            </p>
          )}
        </GlassPanel>
      )}
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
  return (
    <div className="mt-4 flex gap-1 rounded-full bg-black/25 p-1">
      <button
        type="button"
        aria-pressed={mode === 'signin'}
        onClick={() => onChange('signin')}
        className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition ${
          mode === 'signin' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
        }`}
      >
        Sign in
      </button>
      <button
        type="button"
        aria-pressed={mode === 'signup'}
        onClick={() => onChange('signup')}
        className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition ${
          mode === 'signup' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
        }`}
      >
        Create account
      </button>
    </div>
  )
}
