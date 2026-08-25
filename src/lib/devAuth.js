import { supabase } from './supabase.js';

const DEV_EMAIL = import.meta.env.VITE_DEV_USER_EMAIL;
const DEV_PASSWORD = import.meta.env.VITE_DEV_USER_PASSWORD;
const DEV_ENABLED = import.meta.env.DEV;

/**
 * Dev-only Supabase sign-in. Never available in production builds.
 * Reads the dev user from VITE_DEV_USER_EMAIL / VITE_DEV_USER_PASSWORD.
 * If the dev user does not exist yet, it is auto-created (requires email
 * confirmation to be disabled for the dev Supabase project).
 */
export async function devLogin({ email = DEV_EMAIL, password = DEV_PASSWORD } = {}) {
  if (!DEV_ENABLED) {
    throw new Error('devLogin() is only available in development');
  }

  if (!email || !password) {
    throw new Error(
      'Set VITE_DEV_USER_EMAIL and VITE_DEV_USER_PASSWORD in your .env to use dev login.'
    );
  }

  // Already signed in?
  const { data: current } = await supabase.auth.getSession();
  if (current?.session) return current.session;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && /invalid login credentials/i.test(error.message)) {
    // Auto-provision the dev user (dev Supabase project should have email
    // confirmation disabled so signUp returns a session immediately).
    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: { data: { dev_user: true } },
    });

    if (signUp.error) throw signUp.error;

    if (signUp.data?.session) return signUp.data.session;

    // Email confirmation may be on; retry the password login.
    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (retry.error) throw retry.error;
    return retry.data.session;
  }

  if (error) throw error;
  return data.session;
}
