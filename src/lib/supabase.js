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
  const ext = file.name.split('.').pop() || 'bin';
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

  if (error) throw new Error(`Upload failed: ${error.message || error}`);

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(path);

  return urlData.publicUrl;
}
