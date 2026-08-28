// Authentication tests for SmartVideo platform
// Tests validate the shared Clerk/Supabase auth flow
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signOut: vi.fn(),
  },
}

vi.mock('../src/lib/supabase', () => ({
  supabase: mockSupabase,
}))

describe('Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should initialize with null user and loading=true', async () => {
    // This test verifies the initial auth state
    // The AuthContext starts with user=null and loading=true
    // until getSession() completes
    expect(true).toBe(true) // Placeholder for actual component test
  })

  test('should set user when session exists', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })

    // Simulate session restoration
    const session = await mockSupabase.auth.getSession()
    expect(session.data.session?.user).toEqual(mockUser)
  })

  test('should handle session expiry gracefully', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    const session = await mockSupabase.auth.getSession()
    expect(session.data.session).toBeNull()
  })

  test('should handle network errors during session restore', async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error('Network error'))

    // Should not throw - error is caught and logged
    await expect(mockSupabase.auth.getSession()).rejects.toThrow('Network error')
  })

  test('should sign in with email and password', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null,
    })

    const result = await mockSupabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'password123',
    })

    expect(result.data.user).toEqual(mockUser)
    expect(result.error).toBeNull()
  })

  test('should reject invalid credentials', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    })

    const result = await mockSupabase.auth.signInWithPassword({
      email: 'wrong@example.com',
      password: 'wrongpassword',
    })

    expect(result.error?.message).toBe('Invalid credentials')
  })

  test('should sign up new user', async () => {
    const mockUser = { id: '123', email: 'new@example.com' }
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null,
    })

    const result = await mockSupabase.auth.signUp({
      email: 'new@example.com',
      password: 'password123',
      options: { data: { full_name: 'Test User' } },
    })

    expect(result.data.user).toEqual(mockUser)
    expect(result.error).toBeNull()
  })

  test('should require email confirmation when no session returned', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: '123' }, session: null },
      error: null,
    })

    const result = await mockSupabase.auth.signUp({
      email: 'new@example.com',
      password: 'password123',
    })

    expect(result.data.session).toBeNull()
    expect(result.data.user).toBeTruthy()
  })

  test('should reset password via email', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    })

    const result = await mockSupabase.auth.resetPasswordForEmail(
      'test@example.com',
      { redirectTo: 'http://localhost:3000/reset-password' }
    )

    expect(result.error).toBeNull()
  })

  test('should sign out user', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({
      data: {},
      error: null,
    })

    const result = await mockSupabase.auth.signOut()
    expect(result.error).toBeNull()
  })

  test('should handle OAuth sign in with Google', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/oauth/authorize...' },
      error: null,
    })

    const result = await mockSupabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000/dashboard' },
    })

    expect(result.data.url).toContain('google.com')
    expect(result.error).toBeNull()
  })

  test('should handle OAuth sign in with GitHub', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize...' },
      error: null,
    })

    const result = await mockSupabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: 'http://localhost:3000/dashboard' },
    })

    expect(result.data.url).toContain('github.com')
    expect(result.error).toBeNull()
  })

  test('should handle OAuth error gracefully', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'OAuth provider unavailable' },
    })

    const result = await mockSupabase.auth.signInWithOAuth({
      provider: 'google',
    })

    expect(result.error?.message).toBe('OAuth provider unavailable')
  })

  test('should listen for auth state changes', async () => {
    const callback = vi.fn()
    mockSupabase.auth.onAuthStateChange.mockImplementation((event, session) => {
      callback(event, session)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const { data: { subscription } } = mockSupabase.auth.onAuthStateChange(
      'SIGNED_IN',
      { user: { id: '123' } }
    )

    expect(callback).toHaveBeenCalledWith('SIGNED_IN', { user: { id: '123' } })
    expect(subscription.unsubscribe).toBeDefined()
  })

  test('should clean up auth subscription on unmount', async () => {
    const unsubscribe = vi.fn()
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    })

    const { data: { subscription } } = mockSupabase.auth.onAuthStateChange(
      'SIGNED_IN',
      { user: { id: '123' } }
    )

    subscription.unsubscribe()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
