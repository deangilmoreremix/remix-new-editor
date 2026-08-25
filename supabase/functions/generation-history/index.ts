import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CORS_ORIGIN = Deno.env.get('CORS_ORIGIN') || '*';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[generation-history] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-User-Key',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_STUDIO_TYPES = [
  'image', 'video', 'cinema', 'character', 'effects',
  'edit', 'upscale', 'storyboard', 'commercial', 'influencer',
] as const;

const VALID_GENERATION_TYPES = ['image', 'video', 'audio', 'text'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a tenant + user_profile exist for the given muapi_key.
 * Returns { userId, tenantId }.
 *
 * Strategy:
 *  1. Look up an existing user_profile whose preferences contain the muapi_key.
 *  2. If none exists, create a Supabase Auth user (so the FK into auth.users
 *     is satisfied), a tenant, and the user_profile row — all via service_role.
 */
async function ensureUserProfile(
  supabase: ReturnType<typeof createClient>,
  muapi_key: string,
): Promise<{ userId: string; tenantId: string }> {
  // 1. Try existing lookup by preferences JSON
  const { data: existing, error: lookupErr } = await supabase
    .from('user_profiles')
    .select('id, tenant_id')
    .contains('preferences', { muapi_key })
    .maybeSingle();

  if (lookupErr) {
    // Fallback: query might fail on some PostgREST versions; proceed to email lookup
  }

  if (existing) {
    return { userId: existing.id, tenantId: existing.tenant_id };
  }

  // 2. Try lookup by email suffix (backup)
  const email = `${muapi_key}@smartvideo.app`;
  const { data: byEmail } = await supabase
    .from('user_profiles')
    .select('id, tenant_id')
    .eq('email', email)
    .maybeSingle();

  if (byEmail) {
    return { userId: byEmail.id, tenantId: byEmail.tenant_id };
  }

  // 3. Create auth user
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { muapi_key, source: 'generation-history' },
  });

  if (authErr || !authUser.user) {
    throw new Error(`Failed to create auth user: ${authErr?.message ?? 'unknown'}`);
  }

  // 4. Create tenant
  const tenantSlug = `user_${crypto.randomUUID().slice(0, 8)}`;
  const { data: tenantData, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      name: `User ${muapi_key.slice(0, 12)}`,
      slug: tenantSlug,
      plan_type: 'free',
      settings: { muapi_key },
    })
    .select('id')
    .single();

  if (tenantErr || !tenantData) {
    throw new Error(`Failed to create tenant: ${tenantErr?.message ?? 'unknown'}`);
  }

  // 5. Create user_profile
  const { data: profileData, error: profileErr } = await supabase
    .from('user_profiles')
    .insert({
      id: authUser.user.id,
      tenant_id: tenantData.id,
      email,
      preferences: { muapi_key },
    })
    .select('id, tenant_id')
    .single();

  if (profileErr || !profileData) {
    throw new Error(`Failed to create user profile: ${profileErr?.message ?? 'unknown'}`);
  }

  return { userId: profileData.id, tenantId: profileData.tenant_id };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Config check — create a fresh service-role client per request
  // (same pattern as process-upload, create-share)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ||
    (req.method === 'GET' ? 'list' : 'save');

  // Identify the caller via x-user-key header (the getUserKey() value)
  const user_key =
    req.headers.get('x-user-key') ||
    url.searchParams.get('user_key') ||
    'anonymous';

  // ------------------------------------------------------------------
  // GET — list generations for a user
  // ------------------------------------------------------------------
  if (req.method === 'GET' || action === 'list') {
    try {
      const { userId } = await ensureUserProfile(supabase, user_key);

      const { data, error } = await supabase
        .from('generation_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('[generation-history] List error:', error.message);
        return new Response(
          JSON.stringify({ error: error.message, data: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: data ?? [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('[generation-history] List handler error:', (err as Error).message);
      return new Response(
        JSON.stringify({ error: (err as Error).message, data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // ------------------------------------------------------------------
  // POST — save a generation
  // ------------------------------------------------------------------
  if (req.method === 'POST' || action === 'save') {
    try {
      interface SaveRequest {
        studio: string;
        type: string;
        url: string;
        prompt?: string;
        model?: string;
        parameters?: Record<string, unknown>;
        thumbnail_url?: string;
        [key: string]: unknown;
      }

      const body: SaveRequest = await req.json();
      const {
        studio,
        type,
        url: output_url,
        prompt = '',
        model = 'unknown',
        parameters = {},
        thumbnail_url,
        ...extra
      } = body;

      // --- Validate required fields ---
      if (!output_url) {
        return new Response(
          JSON.stringify({ error: 'url (output_url) is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // --- Validate against CHECK constraints ---
      if (!VALID_STUDIO_TYPES.includes(studio as typeof VALID_STUDIO_TYPES[number])) {
        return new Response(
          JSON.stringify({ error: `Invalid studio_type: ${studio}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!VALID_GENERATION_TYPES.includes(type as typeof VALID_GENERATION_TYPES[number])) {
        return new Response(
          JSON.stringify({ error: `Invalid generation_type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // --- Ensure user profile + tenant exist ---
      const { userId, tenantId } = await ensureUserProfile(supabase, user_key);

      // --- Insert into generation_history ---
      const { data, error } = await supabase
        .from('generation_history')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          studio_type: studio,
          generation_type: type,
          model_name: model,
          prompt: prompt,
          parameters: parameters,
          input_assets: [],
          output_url: output_url,
          thumbnail_url: thumbnail_url || output_url,
          status: 'completed',
          completed_at: new Date().toISOString(),
          is_public: false,
          metadata: { muapi_key: user_key, ...extra },
        })
        .select()
        .single();

      if (error) {
        console.error('[generation-history] Save error:', error.message);
        return new Response(
          JSON.stringify({ error: error.message, saved_to_local: true }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[generation-history] Saved generation for user ${user_key.slice(0, 8)}...`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('[generation-history] Save handler error:', (err as Error).message);
      return new Response(
        JSON.stringify({ error: (err as Error).message, saved_to_local: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // ------------------------------------------------------------------
  // Unknown action
  // ------------------------------------------------------------------
  return new Response(
    JSON.stringify({ error: 'Invalid action. Use ?action=list or ?action=save' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
