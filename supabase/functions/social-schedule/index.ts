import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEntitlement, verifyClerkToken } from "../_shared/clerkAuth.ts";
import { MAX_PENDING_PER_USER, validateCreateRequest } from "../_shared/scheduledPosts.ts";

// social-schedule — create / cancel scheduled social posts.
//
// POST { action: "create", platform, account_id, media_url, thumbnail_url?,
//        run_at, payload, muapi_api_key }
// POST { action: "cancel", id }
// POST { action: "revoke_key" }   cancels scheduled posts and deletes the stored key
//
// Listing is done directly by the client (RLS lets owners read their own rows).
// The user's Muapi key is written to Vault and never returned or logged.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const DEFAULT_ALLOWED_ORIGINS = [
  "https://smartvid.app",
  "https://www.smartvid.app",
  "https://smartvideo2.netlify.app",
  "https://ai-vfx.smartvid.app",
  "https://video-agent.smartvid.app",
];
const DEPLOY_PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d+--smartvideo2\.netlify\.app$/;

function configuredOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const configured = configuredOrigins();
  const allowed = configured.length > 0
    ? configured.includes(origin)
    : DEFAULT_ALLOWED_ORIGINS.includes(origin) || DEPLOY_PREVIEW_ORIGIN.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : (configured[0] || DEFAULT_ALLOWED_ORIGINS[0]),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// Never echo back anything that could contain the key.
const PUBLIC_COLUMNS =
  "id, platform, account_id, media_url, thumbnail_url, payload, run_at, status, attempts, request_id, result, error, created_at, updated_at";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[social-schedule] Missing Supabase environment");
    return json(req, { error: "Server configuration error" }, 500);
  }

  const denial = await requireEntitlement(req, corsHeaders(req));
  if (denial) return denial;
  const identity = await verifyClerkToken(req);
  if (!identity) return json(req, { error: "AUTH_REQUIRED" }, 401);
  const userId = identity.userId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Request body must be JSON." }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (body.action) {
      case "create": {
        const parsed = validateCreateRequest(body);
        if (!parsed.ok) return json(req, { error: parsed.error }, 400);
        const v = parsed.value;

        const { count, error: countError } = await supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("clerk_user_id", userId)
          .in("status", ["scheduled", "publishing", "processing"]);
        if (countError) throw countError;
        if ((count ?? 0) >= MAX_PENDING_PER_USER) {
          return json(req, { error: `You can have at most ${MAX_PENDING_PER_USER} pending scheduled posts.` }, 429);
        }

        const { error: keyError } = await supabase.rpc("save_schedule_key", { p_user: userId, p_key: v.muapiKey });
        if (keyError) throw keyError;

        const { data, error } = await supabase
          .from("scheduled_posts")
          .insert({
            clerk_user_id: userId,
            platform: v.platform,
            account_id: v.accountId,
            media_url: v.mediaUrl,
            thumbnail_url: v.thumbnailUrl,
            payload: v.payload,
            run_at: v.runAt.toISOString(),
          })
          .select(PUBLIC_COLUMNS)
          .single();
        if (error) throw error;
        return json(req, { post: data }, 201);
      }

      case "cancel": {
        if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
          return json(req, { error: "id must be a post id." }, 400);
        }
        const { data, error } = await supabase
          .from("scheduled_posts")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", body.id)
          .eq("clerk_user_id", userId)
          .eq("status", "scheduled")
          .select(PUBLIC_COLUMNS)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return json(req, { error: "Only posts that have not started publishing can be cancelled." }, 409);
        }
        await supabase.rpc("delete_schedule_key_if_idle", { p_user: userId });
        return json(req, { post: data });
      }

      case "revoke_key": {
        const { error } = await supabase
          .from("scheduled_posts")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("clerk_user_id", userId)
          .eq("status", "scheduled");
        if (error) throw error;
        const { data: deleted, error: delError } = await supabase.rpc("delete_schedule_key_if_idle", { p_user: userId });
        if (delError) throw delError;
        if (!deleted) {
          return json(req, { error: "Some posts are still publishing. Your key is removed as soon as they finish." }, 409);
        }
        return json(req, { revoked: true });
      }

      default:
        return json(req, { error: "Unknown action." }, 400);
    }
  } catch (err) {
    console.error("[social-schedule] failed:", (err as Error)?.message ?? err);
    return json(req, { error: "Could not complete the request." }, 500);
  }
});
