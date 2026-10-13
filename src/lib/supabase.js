import { createClient } from '@supabase/supabase-js';
import { getUserKey } from './userKey.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables at startup
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing required environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY');
  // Provide a graceful degradation - still export client but log warning
}

// Create client with error handling
let supabase;
try {
  supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
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

/**
 * Attach the caller identity (`x-user-key`) to every request. The RLS
 * policies derive the row owner from this header, and the identity can
 * change at runtime (Clerk sign-in/out), so it is refreshed lazily on
 * every `.from()` / `.storage` access instead of being frozen at startup.
 */
function refreshUserHeader(client) {
  try {
    const key = getUserKey();
    if (client?.rest?.headers) client.rest.headers['x-user-key'] = key;
    if (client?.storage?.headers) client.storage.headers['x-user-key'] = key;
  } catch { /* identity unavailable — policies fall back to the anonymous owner */ }
}

/** Refresh the shared client's identity header (also called internally). */
export function refreshSupabaseUserHeader() {
  refreshUserHeader(supabase);
}

// Wrap the client so identity-bearing requests always carry a fresh
// `x-user-key`; the proxy is transparent to all existing consumers.
supabase = new Proxy(supabase, {
  get(target, prop) {
    if (prop === 'from' || prop === 'storage' || prop === 'rpc' || prop === 'functions') {
      refreshUserHeader(target);
    }
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

export { supabase, getUserKey };

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
