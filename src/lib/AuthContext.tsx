import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { getErrorMessage, logError } from './errors'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; needsConfirmation?: boolean }>
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// AUTHENTICATION REMOVED: App is now fully public. Auth functions are kept
// as no-op stubs for components that reference them but are no longer called.
export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User | null>(null)
  const [session] = useState<Session | null>(null)
  const [loading] = useState(false)

  // No-op auth functions for backward compatibility
  const signIn = async (): Promise<{ error?: string }> => ({})
  const signUp = async (): Promise<{ error?: string; needsConfirmation?: boolean }> => ({})
  const signInWithGoogle = async (): Promise<void> => {}
  const signInWithGitHub = async (): Promise<void> => {}
  const resetPassword = async (): Promise<{ error?: string }> => ({})
  const signOut = async (): Promise<void> => {}

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signInWithGoogle, signInWithGitHub, resetPassword, signOut }}
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
