// supabase/functions/_shared/scheduledPosts.ts
//
// Pure helpers shared by the social-schedule and social-schedule-worker edge
// functions (no Deno or network access, so they are unit-testable in vitest).
//
// A scheduled post stores exactly what the live Social Publish modal would have
// sent to `${platform}-publish` (see components/modals/SocialPublishModal.jsx
// buildPayload) so the worker can replay it at run_at.

export const SCHEDULE_PLATFORMS = ["youtube", "tiktok", "instagram"] as const;
export type SchedulePlatform = (typeof SCHEDULE_PLATFORMS)[number];

export const MIN_LEAD_SECONDS = 60;
export const MAX_LEAD_DAYS = 90;
export const MAX_PENDING_PER_USER = 100;
export const MAX_ATTEMPTS = 3;
const MAX_URL_LENGTH = 2048;

// Fields the publish endpoint accepts, per platform. Anything else the client
// sends is dropped so a scheduled row can never carry arbitrary request params.
const PAYLOAD_FIELDS: Record<SchedulePlatform, readonly string[]> = {
  youtube: ["title", "description", "tags", "privacy", "category_id", "made_for_kids"],
  tiktok: ["title", "privacy_level", "disable_comment", "disable_duet", "disable_stitch"],
  instagram: ["caption", "media_type", "placement", "share_to_feed", "cover_url", "thumb_offset"],
};

export interface ValidCreateRequest {
  platform: SchedulePlatform;
  accountId: number;
  mediaUrl: string;
  thumbnailUrl: string | null;
  runAt: Date;
  payload: Record<string, unknown>;
  muapiKey: string;
}

export type ValidationResult =
  | { ok: true; value: ValidCreateRequest }
  | { ok: false; error: string };

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Keep only the publish fields allowed for the platform. */
export function pickPublishFields(
  platform: SchedulePlatform,
  payload: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!payload || typeof payload !== "object") return out;
  const source = payload as Record<string, unknown>;
  for (const field of PAYLOAD_FIELDS[platform]) {
    if (source[field] !== undefined && source[field] !== null) out[field] = source[field];
  }
  return out;
}

export function validateCreateRequest(body: unknown, now: Date = new Date()): ValidationResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be a JSON object." };
  const b = body as Record<string, unknown>;

  const platform = b.platform;
  if (typeof platform !== "string" || !(SCHEDULE_PLATFORMS as readonly string[]).includes(platform)) {
    return { ok: false, error: `platform must be one of: ${SCHEDULE_PLATFORMS.join(", ")}.` };
  }

  const accountId = Number(b.account_id);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    return { ok: false, error: "account_id must be a positive integer." };
  }

  if (!isHttpsUrl(b.media_url)) return { ok: false, error: "media_url must be a public https URL." };
  const thumbnailUrl = b.thumbnail_url == null || b.thumbnail_url === "" ? null : b.thumbnail_url;
  if (thumbnailUrl !== null && !isHttpsUrl(thumbnailUrl)) {
    return { ok: false, error: "thumbnail_url must be a public https URL." };
  }

  if (typeof b.run_at !== "string") return { ok: false, error: "run_at must be an ISO 8601 timestamp." };
  const runAt = new Date(b.run_at);
  if (Number.isNaN(runAt.getTime())) return { ok: false, error: "run_at must be an ISO 8601 timestamp." };
  const leadSeconds = (runAt.getTime() - now.getTime()) / 1000;
  if (leadSeconds < MIN_LEAD_SECONDS) {
    return { ok: false, error: `run_at must be at least ${MIN_LEAD_SECONDS} seconds in the future.` };
  }
  if (leadSeconds > MAX_LEAD_DAYS * 86400) {
    return { ok: false, error: `run_at must be within ${MAX_LEAD_DAYS} days.` };
  }

  const muapiKey = typeof b.muapi_api_key === "string" ? b.muapi_api_key.trim() : "";
  if (!muapiKey || muapiKey.length > 256) {
    return { ok: false, error: "muapi_api_key is required to publish at the scheduled time." };
  }

  const payload = pickPublishFields(platform as SchedulePlatform, b.payload);
  if (platform === "youtube" && (typeof payload.title !== "string" || payload.title.trim() === "")) {
    return { ok: false, error: "A YouTube post needs a title." };
  }
  if (JSON.stringify(payload).length > 16 * 1024) {
    return { ok: false, error: "payload is too large." };
  }

  return {
    ok: true,
    value: {
      platform: platform as SchedulePlatform,
      accountId,
      mediaUrl: b.media_url as string,
      thumbnailUrl,
      runAt,
      payload,
      muapiKey,
    },
  };
}

/** The exact JSON body sent to `${platform}-publish`. */
export function buildPublishBody(row: {
  platform: SchedulePlatform;
  account_id: number;
  media_url: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...pickPublishFields(row.platform, row.payload),
    account_id: row.account_id,
    media_url: row.media_url,
  };
}

export type SubmitOutcome =
  | { kind: "retry"; delaySeconds: number }
  | { kind: "fail" };

/**
 * Decide what to do with a failed publish submit. Only throttling (429) and
 * transient upstream errors (5xx) or network failures (status 0) are retried;
 * every other 4xx means Muapi rejected the request, so retrying cannot help.
 */
export function classifySubmitFailure(status: number, attempts: number): SubmitOutcome {
  const transient = status === 0 || status === 429 || status >= 500;
  if (!transient || attempts >= MAX_ATTEMPTS) return { kind: "fail" };
  return { kind: "retry", delaySeconds: 60 * 2 ** (attempts - 1) };
}

export function pollResultState(
  result: { status?: unknown; error?: unknown; message?: unknown } | null,
): "done" | "failed" | "pending" {
  const status = typeof result?.status === "string" ? result.status.toLowerCase() : "";
  if (status === "completed" || status === "succeeded") return "done";
  if (status === "failed" || status === "error") return "failed";
  return "pending";
}

/**
 * The YouTube publish result only carries the watch URL
 * (https://youtube.com/watch?v=<id>), so the video id is parsed from it.
 * Mirrors extractYoutubeVideoId in src/lib/socialPublishing.js.
 */
export function extractYoutubeVideoId(urlOrId: unknown): string | null {
  if (typeof urlOrId !== "string" || !urlOrId) return null;
  const id = /^[A-Za-z0-9_-]{11}$/;
  if (id.test(urlOrId)) return urlOrId;
  try {
    const u = new URL(urlOrId);
    const v = u.searchParams.get("v");
    if (v && id.test(v)) return v;
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/) ||
      (u.hostname === "youtu.be" ? u.pathname.match(/^\/([A-Za-z0-9_-]{11})/) : null);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
