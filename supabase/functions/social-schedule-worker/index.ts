import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPublishBody,
  classifySubmitFailure,
  constantTimeEqual,
  pollResultState,
  type SchedulePlatform,
} from "../_shared/scheduledPosts.ts";

// social-schedule-worker — woken every minute by pg_cron (run_social_schedule_worker).
//
// Each run: (1) fail rows stuck mid-publish, (2) claim due posts and submit them
// to Muapi `${platform}-publish`, (3) poll in-flight posts for their result,
// (4) delete the stored Muapi key of any user left with nothing pending.
// Authenticated by the shared x-cron-secret header, never by a user token.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("SOCIAL_SCHEDULE_CRON_SECRET");
const MUAPI_BASE_URL = (Deno.env.get("MUAPI_BASE_URL") || "https://api.muapi.ai").replace(/\/+$/, "");

const CLAIM_BATCH = 10;
const POLL_BATCH = 25;
const REQUEST_TIMEOUT_MS = 20_000;
const GIVE_UP_AFTER_MS = 30 * 60 * 1000;

interface PostRow {
  id: string;
  clerk_user_id: string;
  platform: SchedulePlatform;
  account_id: number;
  media_url: string;
  payload: Record<string, unknown>;
  attempts: number;
  request_id: string | null;
  updated_at: string;
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function setStatus(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase!
    .from("scheduled_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[social-schedule-worker] status update failed:", id, error.message);
}

async function muapiFetch(path: string, key: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${MUAPI_BASE_URL}/api/v1/${path}`, {
    ...init,
    headers: { "x-api-key": key, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function keyFor(userId: string): Promise<string | null> {
  const { data, error } = await supabase!.rpc("read_schedule_key", { p_user: userId });
  if (error) {
    console.error("[social-schedule-worker] key lookup failed for a user:", error.message);
    return null;
  }
  return typeof data === "string" && data ? data : null;
}

async function submit(row: PostRow) {
  const key = await keyFor(row.clerk_user_id);
  if (!key) {
    return setStatus(row.id, { status: "failed", error: "No Muapi key is stored for this account. Schedule the post again." });
  }

  let httpStatus = 0;
  let detail = "";
  try {
    const res = await muapiFetch(`${row.platform}-publish`, key, {
      method: "POST",
      body: JSON.stringify(buildPublishBody(row)),
    });
    httpStatus = res.status;
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const requestId = body?.request_id || body?.id;
      if (requestId) {
        return setStatus(row.id, { status: "processing", request_id: String(requestId), error: null });
      }
      detail = "Muapi accepted the publish call but returned no request id.";
      httpStatus = 502;
    } else {
      detail = String(body?.error || body?.message || body?.detail || `Muapi returned HTTP ${res.status}`);
    }
  } catch (err) {
    detail = `Could not reach Muapi: ${(err as Error)?.message ?? "network error"}`;
    httpStatus = 0;
  }

  const outcome = classifySubmitFailure(httpStatus, row.attempts);
  if (outcome.kind === "retry") {
    return setStatus(row.id, {
      status: "scheduled",
      run_at: new Date(Date.now() + outcome.delaySeconds * 1000).toISOString(),
      error: detail.slice(0, 500),
    });
  }
  return setStatus(row.id, { status: "failed", error: detail.slice(0, 500) });
}

async function poll(row: PostRow) {
  if (!row.request_id) {
    return setStatus(row.id, { status: "failed", error: "Missing Muapi request id." });
  }
  if (Date.now() - new Date(row.updated_at).getTime() > GIVE_UP_AFTER_MS) {
    // updated_at only moves on status changes, so this is time spent processing.
    return setStatus(row.id, { status: "failed", error: "The platform did not confirm the post in time. Check it before scheduling again." });
  }
  const key = await keyFor(row.clerk_user_id);
  if (!key) return; // try again next minute; the key is only removed once nothing is in flight

  try {
    const res = await muapiFetch(`predictions/${encodeURIComponent(row.request_id)}/result`, key, { method: "GET" });
    if (!res.ok) return; // transient; the 30-minute cap above ends a permanently failing poll
    const result = await res.json().catch(() => null);
    const state = pollResultState(result);
    if (state === "done") return setStatus(row.id, { status: "published", result, error: null });
    if (state === "failed") {
      const msg = String(result?.error || result?.message || "Publishing failed on the platform.");
      return setStatus(row.id, { status: "failed", result, error: msg.slice(0, 500) });
    }
  } catch (err) {
    console.error("[social-schedule-worker] poll failed:", (err as Error)?.message ?? err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!supabase || !CRON_SECRET) {
    console.error("[social-schedule-worker] Missing environment (Supabase or SOCIAL_SCHEDULE_CRON_SECRET)");
    return new Response("Server configuration error", { status: 500 });
  }
  const provided = req.headers.get("x-cron-secret") || "";
  if (!constantTimeEqual(provided, CRON_SECRET)) return new Response("Unauthorized", { status: 401 });

  await supabase.rpc("fail_stuck_scheduled_posts");

  const { data: claimed, error: claimError } = await supabase.rpc("claim_due_scheduled_posts", { p_limit: CLAIM_BATCH });
  if (claimError) console.error("[social-schedule-worker] claim failed:", claimError.message);
  const dueRows = (claimed ?? []) as PostRow[];

  const { data: inflight } = await supabase
    .from("scheduled_posts")
    .select("id, clerk_user_id, platform, account_id, media_url, payload, attempts, request_id, updated_at")
    .eq("status", "processing")
    .order("updated_at")
    .limit(POLL_BATCH);
  const processingRows = (inflight ?? []) as PostRow[];

  await Promise.allSettled([...dueRows.map(submit), ...processingRows.map(poll)]);

  // Don't keep a user's key once they have nothing left to publish.
  const users = new Set([...dueRows, ...processingRows].map((r) => r.clerk_user_id));
  await Promise.allSettled([...users].map((u) => supabase.rpc("delete_schedule_key_if_idle", { p_user: u })));

  return new Response(JSON.stringify({ claimed: dueRows.length, polled: processingRows.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
