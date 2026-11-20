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
// Landing pages (/p/<slug>): POST { pageId, contactId?, data, source } -> stores
// the lead for the page owner (see the pageId branch below).
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
//   -> answers { ok, stored } as soon as the lead is saved; webhooks (with retries),
//      emails, Kit/MailerLite and the delivery log finish in the background.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  isForwardableWebhook, isPrivateAddress, sanitizeData, looksAutomated, emailProblem, verifyTurnstile, parseExtraDomains, emailKeyOf, emailDomain, domainAcceptsMail, isDuplicateError, isMissingColumnError, type DnsResolver, sanitizeSource, attributionOf, savedWebhooks, savedNotifyEmails, uniqueEmails, isValidEmail, buildLeadEmail,
  isCallClip, leadConfigFor, hashKey, MAX_WEBHOOKS, MAX_ATTEMPTS, hostOf, deriveSigningSecret,
  savedEsp, leadContact, espRequests, espCheckRequest, encryptSecret, decryptSecret, ESP_PROVIDERS, deliverWebhook, type Delivery, type DeliverDeps, type HttpCall, type Json,
} from "./logic.ts";
export { isForwardableWebhook, savedWebhooks, isCallClip, leadConfigFor };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLISHED_ID = /^[A-Za-z0-9_-]{8,32}$/;
const ALLOWED_ORIGINS = (Deno.env.get("LEAD_CAPTURE_ALLOWED_ORIGINS") ?? "*")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Notification email via Resend. Set RESEND_API_KEY and LEAD_EMAIL_FROM (an address on a
// domain verified in Resend, e.g. "Leads <leads@yourdomain.com>") as edge function secrets.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const LEAD_EMAIL_FROM = Deno.env.get("LEAD_EMAIL_FROM") ?? "";

// Webhook signing: every delivery carries X-Remix-Signature, an HMAC with a per-owner secret
// derived from this master secret (set WEBHOOK_SIGNING_SECRET to any long random string).
const WEBHOOK_SIGNING_MASTER = Deno.env.get("WEBHOOK_SIGNING_SECRET") ?? "";
// Kit / MailerLite API keys are stored AES-GCM encrypted with this key (any long random string).
const INTEGRATIONS_KEY = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY") ?? "";

// Optional Cloudflare Turnstile: with this secret set, published-video submissions must carry a valid `cf-turnstile-response`.
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
// Optional: comma-separated extra throwaway domains for the "block throwaway emails" setting.
const EXTRA_DISPOSABLE = parseExtraDomains(Deno.env.get("LEAD_EXTRA_DISPOSABLE_DOMAINS"));
// The MX check on the lead's email domain is on unless LEAD_MX_CHECK=off. It only rejects a domain with no MX/A/AAAA records.
const MX_CHECK = (Deno.env.get("LEAD_MX_CHECK") ?? "on").toLowerCase() !== "off";

const KINDS = new Set(["lead-form", "list-builder", "personalizer", "call-attempt"]);
const WEBHOOK_TIMEOUT_MS = 8000; // email requests
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

/**
 * Keep the worker alive for work that finishes after the response is sent (Supabase's EdgeRuntime.waitUntil).
 * Where that isn't available it simply waits, which is the old behavior.
 */
async function afterResponse(work: Promise<unknown>): Promise<void> {
  const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work);
  else await work;
}

function clientKey(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("authorization")?.slice(-24) ?? "anonymous";
}

/** Deno's DNS resolver, or null where the runtime has none (the MX check is then skipped). */
const dnsResolver = (): DnsResolver | null => {
  const resolve = (Deno as unknown as { resolveDns?: DnsResolver }).resolveDns;
  return resolve ? (name, type) => resolve(name, type) : null;
};

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

type Db = ReturnType<typeof createClient>;

/** The real network, clock and DNS guard behind deliverWebhook (tests inject fakes instead). */
const realDeliverDeps: DeliverDeps = {
  fetchFn: (url, init) => fetch(url, init),
  sleepFn: (ms) => new Promise((r) => setTimeout(r, ms)),
  nowFn: () => Date.now(),
  resolvesPublic,
  newId: () => crypto.randomUUID(),
};

async function forward(
  urls: string[],
  payload: Record<string, unknown>,
  { secret = "", maxAttempts = MAX_ATTEMPTS }: { secret?: string; maxAttempts?: number } = {},
): Promise<{ forwarded: number; failed: number; deliveries: Delivery[] }> {
  const body = JSON.stringify(payload);
  const event = typeof payload.event === "string" ? payload.event : "video_opted_in";
  const deliveries = await Promise.all(urls.map((url) => deliverWebhook({ url, body, event, secret, maxAttempts }, realDeliverDeps)));
  const failed = deliveries.filter((d) => !d.ok).length;
  return { forwarded: urls.length - failed, failed, deliveries };
}

/** Per-owner signing secret ("" when WEBHOOK_SIGNING_SECRET isn't set, so deliveries go unsigned). */
const ownerSecret = (ownerId: string) => deriveSigningSecret(WEBHOOK_SIGNING_MASTER, ownerId);

/** The caller's verified Clerk user id (PostgREST validated the JWT), or "". */
async function callerSub(db: Db): Promise<string> {
  const { data } = await db.rpc("current_clerk_sub");
  return typeof data === "string" ? data : "";
}

/** Best-effort delivery log. Pass ownerId when writing with the service role; omit it to use the caller's RLS identity. */
async function logDeliveries(db: Db, ownerId: string | null, ctx: { projectId: string | null; clipId: string | null; kind: string }, deliveries: Delivery[]): Promise<void> {
  if (!deliveries.length) return;
  const rows = deliveries.map((d) => ({
    ...(ownerId ? { clerk_user_id: ownerId } : {}),
    delivery_id: d.deliveryId, project_id: ctx.projectId, clip_id: ctx.clipId, kind: ctx.kind,
    url_host: d.host, ok: d.ok, http_status: d.status, attempts: d.attempts, error: d.error,
  }));
  const { error } = await db.from("webhook_deliveries").insert(rows);
  if (error) console.warn("[lead-capture] delivery log failed:", error.code);
}

type EspStatus = "sent" | "failed" | "not_connected" | null;

/** Run provider calls in order; false on the first non-2xx / network error. Fixed provider hosts only. */
async function callEsp(calls: HttpCall[]): Promise<boolean> {
  for (const c of calls) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(c.url, { ...c.init, signal: ctrl.signal, redirect: "manual" });
      await res.body?.cancel();
      if (!res.ok) { console.warn("[lead-capture] list provider failed:", hostOf(c.url), res.status); return false; }
    } catch (err) {
      console.warn("[lead-capture] list provider error:", hostOf(c.url), (err as Error)?.name);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  return true;
}

/** Subscribe the lead to the owner's Kit tag / MailerLite group (published videos only). */
async function pushToEsp(admin: Db, ownerId: string, esp: ReturnType<typeof savedEsp>, data: Record<string, string>): Promise<EspStatus> {
  const contact = esp ? leadContact(data) : null;
  if (!esp || !contact) return null;
  if (!INTEGRATIONS_KEY) return "not_connected";
  const { data: row } = await admin.from("lead_integrations").select("secret_enc")
    .eq("clerk_user_id", ownerId).eq("provider", esp.provider).maybeSingle();
  const key = row?.secret_enc ? await decryptSecret(INTEGRATIONS_KEY, String(row.secret_enc)) : "";
  if (!key) return "not_connected";
  return (await callEsp(espRequests(esp.provider, key, esp.listId, contact))) ? "sent" : "failed";
}

type EmailStatus = "sent" | "failed" | "not_configured" | null;

/**
 * Email the video owner's recipients (up to 3) about a lead. Every address must already be validated and
 * owner-chosen. One Resend batch request sends a separate email per recipient, so people never see each
 * other's addresses. A batch is all-or-nothing: either every recipient is queued or none are.
 */
async function notify(to: string[], kind: string, data: Record<string, string>, attribution: { utm?: Record<string, string>; referrer?: string } = {}): Promise<{ email: EmailStatus; emailCount: number }> {
  if (!to.length) return { email: null, emailCount: 0 };
  if (!RESEND_API_KEY || !LEAD_EMAIL_FROM) return { email: "not_configured", emailCount: 0 };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const { subject, html, text } = buildLeadEmail(kind, data, attribution);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(to.map((addr) => ({ from: LEAD_EMAIL_FROM, to: [addr], subject, html, text }))),
      signal: ctrl.signal,
    });
    await res.body?.cancel();
    if (!res.ok) { console.warn("[lead-capture] email failed:", res.status); return { email: "failed", emailCount: 0 }; }
    return { email: "sent", emailCount: to.length };
  } catch (err) {
    console.warn("[lead-capture] email error:", (err as Error)?.name);
    return { email: "failed", emailCount: 0 };
  } finally {
    clearTimeout(timer);
  }
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

  // Video landing pages (/p/<slug>): the lead is stored for the page's OWNER
  // when the page is published and its lead form is enabled. No webhooks here:
  // page config is publicly readable, so it never holds forwarding URLs; CRM
  // delivery (Kit / MailerLite) is a separate server-side sync.
  if (body.pageId !== undefined) {
    const pageId = String(body.pageId);
    if (!PUBLISHED_ID.test(pageId)) return json(req, { ok: false, error: "Unknown page" }, 404);
    if (!SUPABASE_SERVICE_ROLE_KEY) return json(req, { ok: false, error: "Lead backend not configured" }, 500);
    const leadData = sanitizeData(body.data);
    if (!Object.keys(leadData).length) return json(req, { ok: false, error: "Empty submission" }, 400);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: pageRow, error: pageError } = await admin.from("landing_pages")
      .select("id, clerk_user_id, config").eq("id", pageId).eq("published", true).maybeSingle();
    if (pageError || !pageRow) return json(req, { ok: false, error: "Unknown page" }, 404);
    const form = ((pageRow.config as Json | null)?.form ?? null) as Json | null;
    // A Puck page keeps its forms inside the design (no config.form); only the old template pages can switch the form off.
    if (form && form.enabled === false) return json(req, { ok: false, error: "This page has no form" }, 400);
    // The same kinds as the timeline: Lead Generator = lead-form, List Builder = list-builder, Personalizer = personalizer.
    const pageKind = typeof body.kind === "string" && KINDS.has(body.kind) && body.kind !== "call-attempt" ? body.kind : "lead-form";
    const pageClip = pageKind === "list-builder" || pageKind === "personalizer" ? "list-builder" : "landing-page";
    // The OpenHiggsBolt app stores its own copy and asks only for delivery, with the service key (a visitor can never do this).
    const trusted = !!SUPABASE_SERVICE_ROLE_KEY && req.headers.get("authorization") === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    const deliverOnly = trusted && body.skipStore === true;
    if (!deliverOnly) {
      const [perPage, perClient] = await Promise.all([
        admin.rpc("rate_limit_check", { p_scope: "lead-page", p_key: pageId, p_limit: 60, p_window_seconds: 60 }),
        admin.rpc("rate_limit_check", { p_scope: "lead-page-client", p_key: await hashKey(clientKey(req), pageId), p_limit: 8, p_window_seconds: 60 }),
      ]);
      if (perPage.data?.allowed === false || perClient.data?.allowed === false) {
        return json(req, { ok: false, error: "Too many submissions — try again shortly" }, 429);
      }
    }
    const contactId = typeof body.contactId === "string" && /^[A-Za-z0-9_-]{6,40}$/.test(body.contactId) ? body.contactId : null;
    const src = body.source && typeof body.source === "object" ? body.source as Json : {};
    const attribution = attributionOf(sanitizeSource(body.source));
    let insertError: { code?: string } | null = null;
    if (!deliverOnly) {
      const r = await admin.from("video_leads").insert({
        clerk_user_id: pageRow.clerk_user_id,
        project_id: pageId,
        clip_id: pageClip,
        kind: pageKind,
        data: leadData,
        source: {
          page: typeof src.page === "string" ? src.page.slice(0, 512) : null,
          userAgent: typeof src.userAgent === "string" ? src.userAgent.slice(0, 512) : null,
          published: true,
          landingPage: true,
          contactId,
        },
        preview: false,
      });
      insertError = r.error;
      if (insertError) console.warn("[lead-capture] landing page insert failed:", insertError.code);
    }
    const ownerId = String(pageRow.clerk_user_id ?? "");
    const afterSave = (async () => {
      const { data: row } = await admin.from("landing_page_form_settings").select("settings").eq("page_id", pageId).maybeSingle();
      const settings = ((row?.settings ?? null) as Json | null);
      if (!settings) return;
      // The settings use the List Builder's shape (webhookEnabled/webhook..., emailEnabled/emailAddress..., espProvider/espListId).
      const hooks = savedWebhooks(settings, true);
      const notifyTo = savedNotifyEmails(settings, true);
      const [sent] = await Promise.all([
        hooks.length
          // The same event and payload the timeline's forms send, so one receiver can serve both.
          ? forward(hooks, { event: "video_opted_in", kind: pageKind, projectId: pageId, clipId: pageClip, pageId, contactId, data: leadData, submittedAt: new Date().toISOString(), ...(Object.keys(attribution).length ? { source: attribution } : {}) }, { secret: await ownerSecret(ownerId) })
          : Promise.resolve({ forwarded: 0, failed: 0, deliveries: [] as Delivery[] }),
        notify(notifyTo, pageKind, leadData, attribution),
        pushToEsp(admin, ownerId, savedEsp(settings), leadData),
      ]);
      await logDeliveries(admin, ownerId, { projectId: pageId, clipId: pageClip, kind: pageKind }, sent.deliveries);
    })().catch((err) => console.warn("[lead-capture] landing page after-save work failed:", (err as Error)?.name));
    await afterResponse(afterSave);
    return json(req, { ok: true, stored: deliverOnly ? true : !insertError });
  }

  if (body.publishedId !== undefined) {
    const publishedId = String(body.publishedId);
    if (!PUBLISHED_ID.test(publishedId)) return json(req, { ok: false, error: "Unknown video" }, 404);
    if (!SUPABASE_SERVICE_ROLE_KEY) return json(req, { ok: false, error: "Lead backend not configured" }, 500);
    // Bots get the same answer a real viewer gets, but nothing is stored or forwarded.
    if (looksAutomated(body.signals)) return json(req, { ok: true, stored: true });
    const human = await verifyTurnstile(TURNSTILE_SECRET, body["cf-turnstile-response"], clientKey(req), (url, init) => fetch(url, init));
    if (!human.ok) return json(req, { ok: false, error: "Please complete the verification and try again." }, 400);
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
    const emailIssue = emailProblem(leadData, { blockDisposable: config.blockDisposableEmails === true, extraDisposable: EXTRA_DISPOSABLE });
    if (emailIssue) return json(req, { ok: false, error: emailIssue }, 400);
    const emailKey = leadKind === "call-attempt" ? "" : emailKeyOf(leadData);
    if (emailKey && MX_CHECK && !(await domainAcceptsMail(emailDomain(emailKey), dnsResolver()))) {
      return json(req, { ok: false, error: "That email address doesn't look reachable. Please check it." }, 400);
    }
    const src = sanitizeSource(body.source);
    const attribution = attributionOf(src);
    const row = {
      clerk_user_id: video.clerk_user_id,
      project_id: publishedId,
      clip_id: leadKind === "list-builder" || leadKind === "personalizer" ? "list-builder" : clipId,
      kind: leadKind,
      data: leadData,
      source: { ...src, published: true },
      preview: false,
    };
    // email_key + its unique index (migration 20261118130000) make a repeat sign-up (same email, same form) a no-op.
    let { error: insertError } = await admin.from("video_leads").insert(emailKey ? { ...row, email_key: emailKey } : row);
    if (isMissingColumnError(insertError)) ({ error: insertError } = await admin.from("video_leads").insert(row)); // migration not applied yet
    if (isDuplicateError(insertError)) return json(req, { ok: true, stored: true, duplicate: true });
    if (insertError) console.warn("[lead-capture] published insert failed:", insertError.code);
    const callNotify = leadKind === "call-attempt"
      ? String((config.callNotifyAddress ?? (config.addon as Json | undefined)?.callNotifyAddress) || "").trim()
      : "";
    const hooks = leadKind === "call-attempt" ? [] : savedWebhooks(config, listBuilder);
    // The recipients always come from the saved project, never from the request.
    const notifyTo = leadKind === "call-attempt" ? (isValidEmail(callNotify) ? [callNotify] : []) : savedNotifyEmails(config, listBuilder);
    const ownerId = String(video.clerk_user_id ?? "");
    // Everything after the lead is saved (webhooks with retries, notification emails, Kit/MailerLite, the delivery
    // log) runs after the viewer has their answer, so a slow or down receiver can never keep their form waiting.
    // The viewer only needs `stored`.
    const afterSave = (async () => {
      const [sent] = await Promise.all([
        hooks.length
          ? forward(hooks, { event: "video_opted_in", kind: leadKind, projectId: publishedId, clipId, data: leadData, submittedAt: new Date().toISOString(), ...(Object.keys(attribution).length ? { source: attribution } : {}) }, { secret: await ownerSecret(ownerId) })
          : Promise.resolve({ forwarded: 0, failed: 0, deliveries: [] as Delivery[] }),
        notify(notifyTo, leadKind, leadData, attribution),
        leadKind === "call-attempt" ? Promise.resolve(null) : pushToEsp(admin, ownerId, savedEsp(config), leadData),
      ]);
      await logDeliveries(admin, ownerId, { projectId: publishedId, clipId, kind: leadKind }, sent.deliveries);
    })().catch((err) => console.warn("[lead-capture] after-save work failed:", (err as Error)?.name));
    await afterResponse(afterSave);
    return json(req, { ok: true, stored: !insertError });
  }

  if (body.action === "list") {
    if (!hasSession) return json(req, { ok: true, leads: [] });
    const base = "id, data, created_at, clip_id, kind, source";
    const load = (cols: string) => {
      let q = db.from("video_leads").select(cols).order("created_at", { ascending: false }).limit(5000);
      if (projectId) q = q.eq("project_id", projectId);
      if (clipId) q = q.eq("clip_id", clipId);
      return q;
    };
    // The follow-up columns exist once 20261118120000_video_leads_followup.sql (status, notes, tags) and
    // 20261118131000_video_leads_followup_hardening.sql (updated_at) are applied; until then fall back a step at a time.
    let { data, error } = await load(`${base}, status, notes, tags, updated_at`);
    if (error) ({ data, error } = await load(`${base}, status, notes, tags`));
    if (error) ({ data, error } = await load(base));
    if (error) return json(req, { ok: false, error: "Could not load leads" }, 500);
    return json(req, { ok: true, leads: data ?? [] });
  }

  // Email-list integrations (Kit / MailerLite): the owner's API key is verified with the provider,
  // then stored encrypted. Keys are never returned, only whether one is connected.
  if (typeof body.action === "string" && body.action.startsWith("integration-")) {
    if (!hasSession) return json(req, { ok: false, error: "Sign in to manage integrations" }, 401);
    if (!SUPABASE_SERVICE_ROLE_KEY || !INTEGRATIONS_KEY) {
      if (body.action === "integration-status") return json(req, { ok: true, configured: false, kit: false, mailerlite: false });
      return json(req, { ok: false, error: "Email-list integrations aren't set up on the server yet" }, 501);
    }
    const ownerId = await callerSub(db);
    if (!ownerId) return json(req, { ok: false, error: "Sign in to manage integrations" }, 401);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.action === "integration-status") {
      const { data: rows } = await admin.from("lead_integrations").select("provider").eq("clerk_user_id", ownerId);
      const have = new Set((rows ?? []).map((r: { provider: string }) => r.provider));
      return json(req, { ok: true, configured: true, kit: have.has("kit"), mailerlite: have.has("mailerlite") });
    }
    const provider = ESP_PROVIDERS.find((p) => p === body.provider);
    if (!provider) return json(req, { ok: false, error: "Unknown provider" }, 400);
    if (body.action === "integration-remove") {
      const { error } = await admin.from("lead_integrations").delete().eq("clerk_user_id", ownerId).eq("provider", provider);
      return error ? json(req, { ok: false, error: "Could not remove it" }, 500) : json(req, { ok: true });
    }
    if (body.action === "integration-save") {
      const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      if (apiKey.length < 8 || apiKey.length > 300 || /\s/.test(apiKey)) return json(req, { ok: false, error: "That doesn't look like an API key" }, 400);
      if (!(await callEsp([espCheckRequest(provider, apiKey)]))) {
        return json(req, { ok: false, error: `${provider === "kit" ? "Kit" : "MailerLite"} rejected that API key` }, 400);
      }
      const { error } = await admin.from("lead_integrations").upsert(
        { clerk_user_id: ownerId, provider, secret_enc: await encryptSecret(INTEGRATIONS_KEY, apiKey), updated_at: new Date().toISOString() },
        { onConflict: "clerk_user_id,provider" },
      );
      return error ? json(req, { ok: false, error: "Could not save the key" }, 500) : json(req, { ok: true });
    }
    return json(req, { ok: false, error: "Unknown action" }, 400);
  }

  // The owner's webhook signing secret, for them to paste into their receiver.
  if (body.action === "signing-secret") {
    if (!hasSession) return json(req, { ok: false, error: "Sign in to view your signing secret" }, 401);
    const secret = await ownerSecret(await callerSub(db));
    return json(req, { ok: true, configured: !!WEBHOOK_SIGNING_MASTER, secret: secret || null });
  }

  // Recent webhook deliveries (own rows only, RLS-enforced).
  if (body.action === "deliveries") {
    if (!hasSession) return json(req, { ok: true, deliveries: [] });
    let query = db.from("webhook_deliveries")
      .select("id, project_id, clip_id, kind, url_host, ok, http_status, attempts, error, created_at")
      .order("created_at", { ascending: false }).limit(20);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) return json(req, { ok: false, error: "Could not load deliveries" }, 500);
    return json(req, { ok: true, deliveries: data ?? [] });
  }

  // Server-side "Test Webhook": no browser CORS limits, signed like a real delivery, one attempt, nothing stored as a lead.
  if (body.action === "test-webhooks") {
    if (!hasSession) return json(req, { ok: false, error: "Sign in to test webhooks" }, 401);
    const urls = (Array.isArray(body.webhooks) ? body.webhooks : []).filter(isForwardableWebhook).slice(0, MAX_WEBHOOKS);
    if (!urls.length) return json(req, { ok: false, error: "No valid https webhook URL" }, 400);
    const secret = await ownerSecret(await callerSub(db));
    const sample = sanitizeData(body.data);
    const out = await forward(urls, {
      event: "video_opted_in", test: true, kind: typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "lead-form",
      projectId, clipId, data: Object.keys(sample).length ? sample : { EMAIL: "test@example.com", NAME: "Test" }, submittedAt: new Date().toISOString(),
    }, { secret, maxAttempts: 1 });
    await logDeliveries(db, null, { projectId, clipId, kind: "test" }, out.deliveries);
    return json(req, {
      ok: true, signed: !!secret,
      results: out.deliveries.map(({ host, ok, status, attempts, error }) => ({ host, ok, status, attempts, error })),
    });
  }

  const data = sanitizeData(body.data);
  if (!Object.keys(data).length) return json(req, { ok: false, error: "Empty submission" }, 400);
  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "lead-form";
  // Caller-supplied webhook URLs are only relayed for a signed-in editor session
  // (preview). Anonymous callers could otherwise use this as an open relay.
  const webhooks = !hasSession ? [] : (Array.isArray(body.webhooks) ? body.webhooks : [])
    .filter(isForwardableWebhook).slice(0, MAX_WEBHOOKS);
  const source = sanitizeSource(body.source);
  const createdAt = new Date().toISOString();

  let stored = false;
  if (hasSession) {
    const { error } = await db.from("video_leads").insert({
      project_id: projectId,
      clip_id: clipId,
      kind,
      data,
      source,
      preview: body.preview !== false,
    });
    stored = !error;
    if (error) console.warn("[lead-capture] insert failed:", error.code);
  }

  // Editor preview: only a signed-in session may choose the recipient, so anonymous
  // callers can't use this function to send mail to arbitrary addresses.
  const previewTo = hasSession
    ? uniqueEmails([...(Array.isArray(body.notificationEmails) ? body.notificationEmails : []), body.notificationEmail])
    : [];
  const previewSecret = webhooks.length ? await ownerSecret(await callerSub(db)) : "";
  const [sent, { email, emailCount }] = await Promise.all([
    webhooks.length
      ? forward(webhooks, { event: "video_opted_in", kind, projectId, clipId, data, submittedAt: createdAt }, { secret: previewSecret })
      : Promise.resolve({ forwarded: 0, failed: 0, deliveries: [] as Delivery[] }),
    notify(previewTo, kind, data, attributionOf(source)),
  ]);
  await logDeliveries(db, null, { projectId, clipId, kind }, sent.deliveries);

  return json(req, { ok: true, stored, forwarded: sent.forwarded, failed: sent.failed, email, emailCount });
});
