import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { auth } from '../../shims/clerk-server';

let _serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}

export async function getSupabaseAsUser(): Promise<SupabaseClient> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Not authenticated');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase URL or anon key');
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.rpc('set_config', {
    setting: 'app.clerk_user_id',
    value: userId,
    is_local: true,
  });
  return client;
}

export function getSupabaseAdmin(): SupabaseClient {
  return getServiceClient();
}

export { getServiceClient as getSupabaseService };
