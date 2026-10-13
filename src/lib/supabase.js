import { createClient } from '@supabase/supabase-js';
import { getUserKey } from './userKey.js';

/**
 * Supabase browser client (Vite env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 *
 * AUTH MODE — Clerk third-party auth (the supported mechanism):
 * this client is created with the supabase-js `auth.accessToken` async
 * option, which resolves a FRESH CLERK SESSION TOKEN for every request
 * (src/lib/personalizationAuth.js -> getPersonalizationAccessToken()).
 * Supabase then verifies that token against the Clerk JWKS, so RLS
 * `auth.jwt() ->> 'sub'` is a CRYPTOGRAPHICALLY VERIFIED identity and
 * client-forged ids cannot match any policy. Docs:
 *   https://supabase.com/docs/guides/auth/third-party/clerk
 *   (the pre-2025-04-01 Clerk JWT-template integration is deprecated and is
 *   NOT used here; the owner-scoped RLS policies live in
 *   supabase/migrations/20261013120000_harden_personalization_rls.sql)
 *
 * Prerequisite (external, human-applied): Clerk connected via the Clerk
 * Dashboard "Connect with Supabase" page (adds the `role: authenticated`
 * claim) AND Clerk added as a third-party provider in the Supabase
 * dashboard (Authentication > Third-Party Auth) with the Clerk Frontend
 * API domain. Until configured, `auth.jwt() ->> 'sub'` is NULL and every
 * policy matches zero rows — the tables FAIL CLOSED, which is safe.
 *
 * Graceful degradation: the accessToken callback returns null when Clerk
 * has no verified session (or no Supabase Auth session exists), and
 * supabase-js then falls back to the anon key — nothing throws at import.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables at startup
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing required environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY');
  // Provide a graceful degradation - still export client but log warning
}

/**
 * The identity token every Supabase request carries.
 *
 * Order of trust (both are verified tokens):
 *   1. the Clerk session token — the docs-prescribed Clerk third-party-auth
 *      mechanism (RLS then keys on the verified Clerk `sub` claim);
 *   2. any Supabase Auth session (e.g. devAuth) — keeps that flow working;
 *   3. null — supabase-js falls back to the anon key.
 *
 * Loaded via dynamic import so this module's static graph stays free of
 * the Clerk runtime, and so a Clerk that is not ready can never break
 * module load.
 *
 * @returns {Promise<string | null>}
 */
async function supabaseAccessToken() {
  try {
    const { getPersonalizationAccessToken } = await import('./personalizationAuth.js');
    const clerkToken = await getPersonalizationAccessToken();
    if (clerkToken) return clerkToken;
  } catch {
    /* Clerk unavailable — fall through to any Supabase Auth session */
  }
  try {
    if (supabase && supabase.auth && typeof supabase.auth.getSession === 'function') {
      const { data } = await supabase.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (token) return token;
    }
  } catch {
    /* no session either — the anon key is used by supabase-js */
  }
  return null;
}

// Create client with error handling
let supabase;
try {
  supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      // Clerk session token → verified Supabase identity (see file header).
      accessToken: supabaseAccessToken,
    },
    global: {
      headers: {
        'X-Client-Info': 'smartvideo'
      }
    }
  });

  // supabase-js replaces `supabase.auth` with a proxy that THROWS on any
  // property access when the `accessToken` option is set. Existing flows
  // read `supabase.auth.getSession()` (devAuth sign-in; session probes in
  // VideoStudio, TimelineEditorPage, thumbnailService, assetStore,
  // PersonalizeModal and PersonalizationHubPanel), so graft a real
  // Supabase Auth client — created WITHOUT accessToken and sharing the
  // same storage key, hence the exact same persisted Supabase session it
  // always had — onto the main client. PostgREST/Storage/Functions/
  // Realtime traffic of the main client is authorized by the Clerk token
  // through the accessToken callback above. A failed graft must not
  // discard the (working) main client, so it fails soft.
  try {
    const authSurface = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'X-Client-Info': 'smartvideo'
        }
      }
    });
    if (authSurface && authSurface.auth) {
      supabase.auth = authSurface.auth;
    }
  } catch {
    /* keep the accessToken client's own auth surface if the graft fails */
  }
} catch (error) {
  console.error('[Supabase] Failed to initialize client:', error);
  // Return a mock client for graceful degradation
  supabase = {
    storage: {
      from: () => ({
        upload: () => Promise.reject(new Error('Supabase not configured')),
        getPublicUrl: () => ({ data: { publicUrl: null } })
      })
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } })
    }
  };
}

export { supabase };

export function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseUrl() {
  return supabaseUrl || '';
}

export function getSupabaseAnonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

export async function uploadFileToStorage(file) {
  const ext = sanitizeFileExtension(file.name);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${await getUserKey()}/${uniqueName}`;

  const timeoutMs = 60000;
  const uploadPromise = supabase.storage
    .from('uploads')
    .upload(path, file, { contentType: file.type, upsert: false });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Upload to storage timed out')), timeoutMs);
  });

  const { error } = await Promise.race([uploadPromise, timeoutPromise]).catch(err => ({ error: err }));

  if (error) {
    // Preserve original error code for debugging
    const enhanced = new Error(`Upload failed: ${error.message || error}`);
    enhanced.code = error.code || error.statusCode;
    enhanced.originalError = error;
    throw enhanced;
  }

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Sanitize file extension to prevent path traversal.
 * Extracts only the last extension, rejects paths with slashes.
 */
function sanitizeFileExtension(fileName) {
  if (!fileName) return 'bin';
  // Reject any path separators
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return 'bin';
  }
  const parts = fileName.split('.');
  if (parts.length < 2) return 'bin';
  // Only use the last extension, alphanumeric only
  const ext = parts.pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return ext || 'bin';
}
