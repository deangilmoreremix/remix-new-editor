// lead-capture — stores and forwards leads from the timeline's interactive
// addons (Lead Generator clip, List Builder / Personalizer).
//
// POST { projectId, clipId, kind, data, webhooks[], notificationEmail, preview, source }
//   -> stores a row in public.video_leads as the CALLER (their Clerk JWT,
//      enforced by RLS — no service role), then POSTs the lead to each
//      configured https webhook server-side.
//   -> { ok, stored, forwarded, failed, email: 'not_configured' | null }
// POST { action: 'list', projectId?, clipId? }
//   -> { ok, leads: [{ id, data, created_at, clip_id, kind }] } (own rows only)
//
// Anonymous callers (no session) can't store rows — RLS needs an owner —
// but their webhooks are still forwarded, matching what the editor preview
// did before this function existed.
//
// Published videos (the public /watch/<id> player):
// POST { publishedId, clipId, kind, data, source }
//   -> the video is looked up with the service role; if it is published,
//      the lead is stored for the video's OWNER (preview = false) and
//      forwarded to the webhooks saved in the published project — webhook
//      URLs and notification emails in the request body are ignored.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isForwardableWebhook, isPrivateAddress, sanitizeData, savedWebhooks, isCallClip, leadConfigFor, hashKey, MAX_WEBHOOKS, type Json } from "./logic.ts";
export { isForwardableWebhook, savedWebhooks, isCallClip, leadConfigFor };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLISHED_ID = /^[A-Za-z0-9_-]{8,32}$/;
const ALLOWED_ORIGINS = (Deno.env.get("LEAD_CAPTURE_ALLOWED_ORIGINS") ?? "*")
  .split(",").map((s) => s.trim()).filter(Boolean);

const KINDS = new Set(["lead-form", "list-builder", "personalizer", "call-attempt"]);
const WEBHOOK_TIMEOUT_MS = 8000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes("*")
    ? "*"
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allow,
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

function rateLimited(key: string): boolean {
  const now = Date.now();
  const rec = rateLimits.get(key);
  if (!rec || now > rec.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT_MAX;
}

function clientKey(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("authorization")?.slice(-24) ?? "anonymous";
}

/** Best-effort DNS check: refuse hosts that resolve to private addresses (rebinding / split-horizon DNS). */
async function resolvesPublic(url: string): Promise<boolean> {
  const host = new URL(url).hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true; // literal already vetted
  try {
    const resolve = (Deno as unknown as { resolveDns?: (h: string, t: string) => Promise<string[]> }).resolveDns;
    if (!resolve) return true; // runtime has no DNS API: literal checks only
    const [a, aaaa] = await Promise.all([resolve(host, "A").catch(() => []), resolve(host, "AAAA").catch(() => [])]);
    const all = [...a, ...aaaa];
    return all.length > 0 && all.every((ip) => !isPrivateAddress(ip));
  } catch { return false; } // deny on resolver errors: only forward when every resolved address is public
}

async function forward(urls: string[], payload: unknown): Promise<{ forwarded: number; failed: number }> {
  const results = await Promise.allSettled(urls.map(async (url) => {
    if (!(await resolvesPublic(url))) throw new Error("blocked address");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "remix-lead-capture/1.0" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
        redirect: "manual",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }));
  const failed = results.filter((r) => r.status === "rejected").length;
  return { forwarded: urls.length - failed, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json(req, { ok: false, error: "Lead backend not configured" }, 500);
  if (rateLimited(clientKey(req))) return json(req, { ok: false, error: "Too many submissions — try again shortly" }, 429);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { ok: false, error: "Invalid JSON" }, 400); }

  const authHeader = req.headers.get("authorization") ?? "";
  // The anon key is sent as a Bearer token when nobody is signed in; only a
  // different token is a user session.
  const hasSession = authHeader.startsWith("Bearer ") && authHeader.slice(7) !== SUPABASE_ANON_KEY;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: hasSession ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const projectId = typeof body.projectId === "string" ? body.projectId.slice(0, 128) : null;
  const clipId = typeof body.clipId === "string" ? body.clipId.slice(0, 128) : null;

  if (body.publishedId !== undefined) {
    const publishedId = String(body.publishedId);
    if (!PUBLISHED_ID.test(publishedId)) return json(req, { ok: false, error: "Unknown video" }, 404);
    if (!SUPABASE_SERVICE_ROLE_KEY) return json(req, { ok: false, error: "Lead backend not configured" }, 500);
    const leadData = sanitizeData(body.data);
    if (!Object.keys(leadData).length) return json(req, { ok: false, error: "Empty submission" }, 400);
    // Shared (database) limits survive across function instances: per video
    // (bounds spam an owner can receive) and per hashed client (raw IPs are never stored).
    const limiter = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const [perVideo, perClient] = await Promise.all([
      limiter.rpc("rate_limit_check", { p_scope: "lead-video", p_key: publishedId, p_limit: 60, p_window_seconds: 60 }),
      limiter.rpc("rate_limit_check", { p_scope: "lead-client", p_key: await hashKey(clientKey(req), publishedId), p_limit: 8, p_window_seconds: 60 }),
    ]);
    if (perVideo.data?.allowed === false || perClient.data?.allowed === false) {
      return json(req, { ok: false, error: "Too many submissions — try again shortly" }, 429);
    }
    const leadKind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "lead-form";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: video, error: videoError } = await admin.from("published_videos")
      .select("id, clerk_user_id, project").eq("id", publishedId).eq("published", true).maybeSingle();
    if (videoError || !video) return json(req, { ok: false, error: "Unknown video" }, 404);
    const { config, listBuilder } = leadConfigFor(video.project as Json, leadKind, clipId);
    if (!config) return json(req, { ok: false, error: "This video has no such form" }, 400);
    const src = body.source && typeof body.source === "object" ? body.source as Json : {};
    const { error: insertError } = await admin.from("video_leads").insert({
      clerk_user_id: video.clerk_user_id,
      project_id: publishedId,
      clip_id: leadKind === "list-builder" || leadKind === "personalizer" ? "list-builder" : clipId,
      kind: leadKind,
      data: leadData,
      source: {
        page: typeof src.page === "string" ? src.page.slice(0, 512) : null,
        userAgent: typeof src.userAgent === "string" ? src.userAgent.slice(0, 512) : null,
        published: true,
      },
      preview: false,
    });
    if (insertError) console.warn("[lead-capture] published insert failed:", insertError.code);
    const callNotify = leadKind === "call-attempt"
      ? String((config.callNotifyAddress ?? (config.addon as Json | undefined)?.callNotifyAddress) || "")
      : "";
    const hooks = leadKind === "call-attempt" ? [] : savedWebhooks(config, listBuilder);
    const sent = hooks.length
      ? await forward(hooks, { event: "video_opted_in", kind: leadKind, projectId: publishedId, clipId, data: leadData, submittedAt: new Date().toISOString() })
      : { forwarded: 0, failed: 0 };
    return json(req, { ok: true, stored: !insertError, ...sent, email: config.emailNotificationEnabled || config.emailEnabled || callNotify ? "not_configured" : null });
  }

  if (body.action === "list") {
    if (!hasSession) return json(req, { ok: true, leads: [] });
    let query = db.from("video_leads").select("id, data, created_at, clip_id, kind").order("created_at", { ascending: false }).limit(5000);
    if (projectId) query = query.eq("project_id", projectId);
    if (clipId) query = query.eq("clip_id", clipId);
    const { data, error } = await query;
    if (error) return json(req, { ok: false, error: "Could not load leads" }, 500);
    return json(req, { ok: true, leads: data ?? [] });
  }

  const data = sanitizeData(body.data);
  if (!Object.keys(data).length) return json(req, { ok: false, error: "Empty submission" }, 400);
  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "lead-form";
  // Caller-supplied webhook URLs are only relayed for a signed-in editor session
  // (preview). Anonymous callers could otherwise use this as an open relay.
  const webhooks = !hasSession ? [] : (Array.isArray(body.webhooks) ? body.webhooks : [])
    .filter(isForwardableWebhook).slice(0, MAX_WEBHOOKS);
  const source = body.source && typeof body.source === "object" ? body.source as Record<string, unknown> : {};
  const createdAt = new Date().toISOString();

  let stored = false;
  if (hasSession) {
    const { error } = await db.from("video_leads").insert({
      project_id: projectId,
      clip_id: clipId,
      kind,
      data,
      source: {
        page: typeof source.page === "string" ? source.page.slice(0, 512) : null,
        userAgent: typeof source.userAgent === "string" ? source.userAgent.slice(0, 512) : null,
      },
      preview: body.preview !== false,
    });
    stored = !error;
    if (error) console.warn("[lead-capture] insert failed:", error.code);
  }

  const { forwarded, failed } = webhooks.length
    ? await forward(webhooks, { event: "video_opted_in", kind, projectId, clipId, data, submittedAt: createdAt })
    : { forwarded: 0, failed: 0 };

  return json(req, {
    ok: true,
    stored,
    forwarded,
    failed,
    // No transactional email provider is wired into this project yet.
    email: body.notificationEmail ? "not_configured" : null,
  });
});
