import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { getErrorMessage, logError } from './errors'
import { removeLegacyBuilderSession } from './legacy-session'

/**
 * State of the SmartVideo single sign-on handshake.
 * - connecting: waiting for the SmartVideo (Clerk) session / token exchange
 * - ready: signed in to the builder as the SmartVideo user
 * - signed_out: no SmartVideo session (or the builder was opened outside SmartVideo)
 * - error: the exchange failed; `retry` tries again
 */
export type SsoStatus = 'connecting' | 'ready' | 'signed_out' | 'error'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  ssoStatus: SsoStatus
  ssoError: string | null
  retrySso: () => void
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; needsConfirmation?: boolean }>
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SSO_ENDPOINT = '/.netlify/functions/website-builder-session'

interface ParentClerk {
  loaded?: boolean
  user?: { id: string } | null
  session?: { getToken: () => Promise<string | null> } | null
  addListener?: (cb: (resources: { user?: { id: string } | null }) => void) => () => void
}

/** The SmartVideo app's Clerk instance. The builder iframe is same-origin. */
function getParentClerk(): ParentClerk | null {
  try {
    if (window.parent === window) return null
    return ((window.parent as unknown as { Clerk?: ParentClerk }).Clerk) ?? null
  } catch {
    return null
  }
}

async function waitForParentClerk(timeoutMs = 10_000): Promise<ParentClerk | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const clerk = getParentClerk()
    if (clerk?.loaded) return clerk
    if (window.parent === window) return null
    await new Promise((r) => setTimeout(r, 150))
  }
  return getParentClerk()
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [ssoStatus, setSsoStatus] = useState<SsoStatus>('connecting')
  const [ssoError, setSsoError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const loading = ssoStatus === 'connecting'

  useEffect(() => {
    // A builder session saved before the builder got its own storage key would
    // otherwise keep sitting where SmartVideo's own client reads it.
    try {
      removeLegacyBuilderSession(window.localStorage, import.meta.env.VITE_SUPABASE_URL as string)
    } catch {
      // storage can be unavailable (private mode, blocked site data): nothing to clean
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Sign in to the builder as the SmartVideo user. Re-runs on retry and when
  // the SmartVideo account changes (sign-in, sign-out, switch).
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined

    const clearBuilderSession = async () => {
      try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* ignore */ }
    }

    const run = async () => {
      setSsoStatus('connecting')
      setSsoError(null)
      const clerk = await waitForParentClerk()
      if (cancelled) return
      if (!clerk?.user || !clerk.session) {
        await clearBuilderSession()
        if (!cancelled) setSsoStatus('signed_out')
        return
      }

      const lastClerkUser = clerk.user.id
      unlisten = clerk.addListener?.(({ user: u }) => {
        if ((u?.id ?? null) !== lastClerkUser) setAttempt((n) => n + 1)
      })

      try {
        const token = await clerk.session.getToken()
        if (!token) throw new Error('No SmartVideo session token')
        const res = await fetch(SSO_ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
        const body = (await res.json().catch(() => ({}))) as { token_hash?: string; email?: string; error?: string }
        if (cancelled) return
        if (res.status === 401) { await clearBuilderSession(); setSsoStatus('signed_out'); return }
        if (!res.ok || !body.token_hash) throw new Error(body.error || `Sign-in failed (${res.status})`)

        // Reuse a live session for the same account; otherwise exchange the token.
        const { data: current } = await supabase.auth.getSession()
        if (current.session?.user?.email?.toLowerCase() !== body.email) {
          const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: body.token_hash })
          if (error) throw error
        }
        if (!cancelled) setSsoStatus('ready')
      } catch (error) {
        logError('WebsiteBuilderSSO', error)
        if (!cancelled) {
          setSsoError(getErrorMessage(error, 'Could not connect your SmartVideo account.'))
          setSsoStatus('error')
        }
      }
    }

    run()
    return () => { cancelled = true; unlisten?.() }
  }, [attempt])

  const retrySso = useCallback(() => setAttempt((n) => n + 1), [])

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      return {}
    } catch (error) {
      logError('AuthSignIn', error)
      return { error: getErrorMessage(error, 'Could not sign in. Please try again.') }
    }
  }

  const signUp = async (email: string, password: string, name: string): Promise<{ error?: string; needsConfirmation?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) return { error: error.message }
      // If no session returned, email confirmation is required
      if (!data.session) return { needsConfirmation: true }
      return {}
    } catch (error) {
      logError('AuthSignUp', error)
      return { error: getErrorMessage(error, 'Could not create your account. Please try again.') }
    }
  }

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/dashboard`,
      })
      if (error) return { error: error.message }
      return {}
    } catch (error) {
      logError('AuthPasswordReset', error)
      return { error: getErrorMessage(error, 'Could not send a reset link. Please try again.') }
    }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      logError('AuthSignOut', error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, ssoStatus, ssoError, retrySso, signIn, signUp, signInWithGoogle, signInWithGitHub, resetPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Auth provider for build-time SSR (src/entry-ssr.tsx): renders children in the
 * logged-out, non-loading state so public pages emit their full marketing
 * content. All actions are no-ops — nothing interactive runs during prerender.
 */
export function StaticAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: null,
        session: null,
        loading: false,
        ssoStatus: 'signed_out',
        ssoError: null,
        retrySso: () => {},
        signIn: async () => ({}),
        signUp: async () => ({}),
        signInWithGoogle: async () => {},
        signInWithGitHub: async () => {},
        resetPassword: async () => ({}),
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within SupabaseAuthProvider')
  return ctx
}
