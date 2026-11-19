// Pure helpers for lead-capture (no Deno globals, so they are unit-testable).
export type Json = Record<string, unknown>;
export const MAX_WEBHOOKS = 3;
/** Stay well below the 32 KB video_leads.data constraint (UTF-8 bytes). */
export const MAX_DATA_BYTES = 24_000;

// Only public https endpoints: blocks localhost / private-range literals so
// the function can't be used to probe internal services.
export function isForwardableWebhook(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) return false; // single-label hosts are internal names
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  if (/^\[.*\]$/.test(host) || host.includes(":")) return false; // IPv6 literals
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224) return false;
  }
  // Numeric-looking hosts that are not dotted quads (e.g. 2130706433, 0x7f.1) can encode IPs.
  if (/^[0-9x.]+$/i.test(host) && !v4) return false;
  return true;
}

/** True when an IP (v4/v6 literal) is private / loopback / link-local. For resolved addresses. */
export function isPrivateAddress(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s.includes(":")) {
    return s === "::1" || s === "::" || s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("::ffff:");
  }
  const m = s.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return true;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** At most 20 short string fields, and never more than MAX_DATA_BYTES of UTF-8 in total. */
export function sanitizeData(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const enc = new TextEncoder();
  let n = 0;
  let bytes = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (n >= 20 || !k || k.length > 64 || v == null) continue;
    const s = String(v).trim().slice(0, 2000);
    if (!s) continue;
    const size = enc.encode(k).length + enc.encode(s).length;
    if (bytes + size > MAX_DATA_BYTES) continue;
    out[k] = s;
    bytes += size;
    n++;
  }
  return out;
}

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;
const cleanText = (v: string, max: number) => v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

/**
 * The `source` stored with a lead: the page and browser, plus the viewer's campaign tags (utm_*) and
 * the site they came from. Only known keys, plain strings, length-capped; the referrer must be http(s).
 */
export function sanitizeSource(raw: unknown): Record<string, unknown> {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Json : {};
  const out: Record<string, unknown> = {
    page: typeof src.page === "string" ? src.page.slice(0, 512) : null,
    userAgent: typeof src.userAgent === "string" ? src.userAgent.slice(0, 512) : null,
  };
  const u = src.utm && typeof src.utm === "object" && !Array.isArray(src.utm) ? src.utm as Json : null;
  if (u) {
    const utm: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = u[k];
      if (typeof v === "string") { const t = cleanText(v, 100); if (t) utm[k] = t; }
    }
    if (Object.keys(utm).length) out.utm = utm;
  }
  if (typeof src.referrer === "string" && /^https?:\/\//i.test(src.referrer.trim())) out.referrer = cleanText(src.referrer, 300);
  if (src.variant === "A" || src.variant === "B") out.variant = src.variant; // which version of an A/B-tested form the viewer saw
  // The viewer's analytics session (only sent when analytics is on), so the owner can see how much of the video the lead watched.
  if (typeof src.session === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(src.session)) out.session = src.session;
  return out;
}

/** Just the marketing attribution (utm + referrer) of a sanitized source, for webhooks and emails. */
export function attributionOf(source: Record<string, unknown>): { utm?: Record<string, string>; referrer?: string } {
  const out: { utm?: Record<string, string>; referrer?: string } = {};
  if (source.utm && typeof source.utm === "object") out.utm = source.utm as Record<string, string>;
  if (typeof source.referrer === "string" && source.referrer) out.referrer = source.referrer;
  return out;
}

/** Short, non-reversible key for rate limiting (so raw IPs are never stored). */
export async function hashKey(value: string, salt = ""): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${value}`));
  return Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Webhook URLs saved on a Lead Generator clip or the List Builder config. */
export function savedWebhooks(config: Json | null | undefined, listBuilder = false): string[] {
  if (!config) return [];
  const pick = (v: unknown) => (v && typeof v === "object" ? (v as Json).value : v);
  const enabled = listBuilder ? !!config.webhookEnabled : config.webhookEnabled !== false;
  if (!enabled) return [];
  const urls = listBuilder
    ? [config.webhook, pick(config.webhook2), pick(config.webhook3)]
    : [config.webhookUrl, config.webhookUrl2, config.webhookUrl3];
  return urls.filter(isForwardableWebhook).slice(0, MAX_WEBHOOKS);
}

/** A clip with a click-to-call phone number (CTA button, or an overlay link set to PHONE). */
export function isCallClip(c: Json): boolean {
  if (c.type === "click-to-call") return !!c.phoneNumber;
  const o = (c.addon && typeof c.addon === "object" ? c.addon : {}) as Json;
  return o.linkMode === "phone" ? !!o.phoneNumber : /^tel:/i.test(String(o.linkUrl || ""));
}

// ------------------------------------------------------- webhook retries + signing

export const MAX_ATTEMPTS = 3;

/** Network errors / timeouts (status null), 408, 429 and 5xx are worth retrying; other 4xx are not. */
export function isRetryable(status: number | null): boolean {
  return status === null || status === 408 || status === 429 || status >= 500;
}

/** Wait before the next attempt, given how many attempts have failed so far (1-based). */
export function backoffMs(failedAttempts: number): number {
  return failedAttempts <= 1 ? 300 : 900;
}

/** Host only: webhook URLs often embed secrets, so logs never keep the path or query. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.slice(0, 255); } catch { return "invalid"; }
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A stable per-owner signing secret derived from a server master secret (nothing to store). */
export async function deriveSigningSecret(master: string, ownerId: string): Promise<string> {
  if (!master || !ownerId) return "";
  return `whsec_${await hmacHex(master, `webhook-signing:${ownerId}`)}`;
}

/**
 * Stripe-style signature header value: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`.
 * Receivers recompute it with their secret and reject old timestamps (replay protection).
 */
export async function signWebhook(secret: string, body: string, timestampSec: number): Promise<string> {
  return `t=${timestampSec},v1=${await hmacHex(secret, `${timestampSec}.${body}`)}`;
}

export const ATTEMPT_TIMEOUT_MS = 5000; // one webhook attempt
export const DELIVERY_BUDGET_MS = 12_000; // all attempts for one webhook

export type Delivery = { deliveryId: string; host: string; ok: boolean; status: number | null; attempts: number; error: string | null };

/** What deliverWebhook needs from the outside world (real fetch/clock in production, fakes in tests). */
export type DeliverDeps = {
  fetchFn: (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal; redirect: "manual" }) =>
    Promise<{ ok: boolean; status: number; body?: { cancel?: () => Promise<unknown> } | null }>;
  sleepFn: (ms: number) => Promise<void>;
  nowFn: () => number;
  /** false when the host resolves to a private address (SSRF guard); checked once, before the first attempt. */
  resolvesPublic: (url: string) => Promise<boolean>;
  newId: () => string;
};

/**
 * Deliver one webhook: signed (when a secret is set), retried with backoff on network errors / timeouts / 408 /
 * 429 / 5xx, never on other 4xx or redirects, and stopped by a total time budget. Every attempt carries the same
 * X-Remix-Delivery id (so receivers can de-duplicate) and a fresh signature timestamp.
 */
export async function deliverWebhook(
  a: { url: string; body: string; event: string; secret: string; maxAttempts: number },
  d: DeliverDeps,
): Promise<Delivery> {
  const deliveryId = d.newId();
  const host = hostOf(a.url);
  if (!(await d.resolvesPublic(a.url))) return { deliveryId, host, ok: false, status: null, attempts: 0, error: "blocked address" };
  const started = d.nowFn();
  let status: number | null = null;
  let error: string | null = null;
  for (let attempt = 1; attempt <= a.maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "remix-lead-capture/1.0",
        "X-Remix-Event": a.event,
        "X-Remix-Delivery": deliveryId,
      };
      if (a.secret) headers["X-Remix-Signature"] = await signWebhook(a.secret, a.body, Math.floor(d.nowFn() / 1000));
      const res = await d.fetchFn(a.url, { method: "POST", headers, body: a.body, signal: ctrl.signal, redirect: "manual" });
      status = res.status;
      await res.body?.cancel?.();
      if (res.ok) return { deliveryId, host, ok: true, status, attempts: attempt, error: null };
      error = `HTTP ${res.status}`;
    } catch (err) {
      status = null;
      error = (err as Error)?.name === "AbortError" ? "timeout" : "network error";
    } finally {
      clearTimeout(timer);
    }
    const wait = backoffMs(attempt);
    if (attempt >= a.maxAttempts || !isRetryable(status) || d.nowFn() - started + wait + ATTEMPT_TIMEOUT_MS > DELIVERY_BUDGET_MS) {
      return { deliveryId, host, ok: false, status, attempts: attempt, error };
    }
    await d.sleepFn(wait);
  }
  return { deliveryId, host, ok: false, status, attempts: a.maxAttempts, error };
}

// ------------------------------------------------ email-list delivery (Kit / MailerLite)

export type EspProvider = "kit" | "mailerlite";
export const ESP_PROVIDERS: readonly EspProvider[] = ["kit", "mailerlite"];
const LIST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** The provider + tag/group id saved on a clip or the List Builder ("" listId = just add the subscriber). */
export function savedEsp(config: Json | null | undefined): { provider: EspProvider; listId: string } | null {
  const provider = config?.espProvider;
  if (typeof provider !== "string" || !(ESP_PROVIDERS as readonly string[]).includes(provider)) return null;
  const raw = String(config?.espListId ?? "").trim();
  return { provider: provider as EspProvider, listId: LIST_ID_RE.test(raw) ? raw : "" };
}

/** The subscriber to add: the first valid email answer, plus a name if one was asked for. */
export function leadContact(data: Record<string, string>): { email: string; name: string } | null {
  const entries = Object.entries(data);
  // The answer key is the (editable) field label, so a label like "Contact address" must still count:
  // prefer a MAIL-labelled value, otherwise take the first value that is a valid email address.
  const email = entries.find(([k, v]) => /MAIL/i.test(k) && isValidEmail(v))?.[1] ?? entries.find(([, v]) => isValidEmail(v))?.[1];
  if (!email) return null;
  const name = entries.find(([k, v]) => /NAME/i.test(k) && !/MAIL/i.test(k) && v)?.[1] ?? "";
  return { email: email.trim(), name: name.slice(0, 100) };
}

export type HttpCall = { url: string; init: { method: string; headers: Record<string, string>; body?: string } };

/** Calls (run in order, stop on the first failure) that subscribe `contact` and tag/group them. */
export function espRequests(provider: EspProvider, apiKey: string, listId: string, contact: { email: string; name: string }): HttpCall[] {
  if (provider === "kit") {
    const headers = { "Content-Type": "application/json", "X-Kit-Api-Key": apiKey };
    const calls: HttpCall[] = [{
      url: "https://api.kit.com/v4/subscribers",
      init: { method: "POST", headers, body: JSON.stringify({ email_address: contact.email, ...(contact.name ? { first_name: contact.name } : {}) }) },
    }];
    if (listId) calls.push({ url: `https://api.kit.com/v4/tags/${encodeURIComponent(listId)}/subscribers`, init: { method: "POST", headers, body: JSON.stringify({ email_address: contact.email }) } });
    return calls;
  }
  return [{
    url: "https://connect.mailerlite.com/api/subscribers",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ email: contact.email, ...(contact.name ? { fields: { name: contact.name } } : {}), ...(listId ? { groups: [listId] } : {}) }),
    },
  }];
}

/** A cheap authenticated GET used to check an API key before saving it. */
export function espCheckRequest(provider: EspProvider, apiKey: string): HttpCall {
  return provider === "kit"
    ? { url: "https://api.kit.com/v4/account", init: { method: "GET", headers: { "X-Kit-Api-Key": apiKey, Accept: "application/json" } } }
    : { url: "https://connect.mailerlite.com/api/subscribers?limit=1", init: { method: "GET", headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } } };
}

/** API keys are stored AES-GCM encrypted: `v1.<iv>.<ciphertext>` (base64). */
async function aesKey(master: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(master));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptSecret(master: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(master), new TextEncoder().encode(plaintext)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

/** "" when the token is malformed or the master key is wrong. */
export async function decryptSecret(master: string, token: string): Promise<string> {
  try {
    const [v, iv, ct] = token.split(".");
    if (v !== "v1" || !iv || !ct) return "";
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(master), unb64(ct)));
  } catch { return ""; }
}

// ------------------------------------------------------------- notification email

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
export function isValidEmail(raw: unknown): raw is string {
  return typeof raw === "string" && raw.trim().length <= 254 && EMAIL_RE.test(raw.trim());
}

export const MAX_NOTIFY_EMAILS = 3;

// ---------------------------------------------------------------------------------------------------- spam signals
/** A person needs longer than this to fill in a form; scripts finish almost instantly. */
export const MIN_FILL_MS = 1500;

/**
 * True when a submission looks automated. `signals` is what the form sends next to the answers: `hp`, the hidden honeypot
 * field's value (people never fill it), and `ms`, how long the form was open (left out when answers were prefilled).
 * Old clients send no signals, so they are never flagged.
 */
export function looksAutomated(signals: unknown): boolean {
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return false;
  const d = signals as Record<string, unknown>;
  if (typeof d.hp === "string" && d.hp.trim()) return true;
  if (d.ms === undefined || d.ms === null || d.ms === "") return false;
  const ms = Number(d.ms);
  return Number.isFinite(ms) && ms >= 0 && ms < MIN_FILL_MS;
}

/** Throwaway-inbox domains. Kept short and static (no paid lookup); owners switch the check on per form. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "grr.la", "10minutemail.com",
  "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net", "tempmailo.com", "throwawaymail.com", "yopmail.com", "yopmail.net",
  "trashmail.com", "trashmail.net", "getnada.com", "nada.email", "maildrop.cc", "dispostable.com", "fakeinbox.com", "mailnesia.com",
  "mintemail.com", "mohmal.com", "emailondeck.com", "burnermail.io", "spamgourmet.com", "mytemp.email", "tmpmail.org", "tmpmail.net",
  "discard.email", "spambox.us", "moakt.com", "inboxkitten.com", "temp-mail.io", "tempinbox.com", "mail.tm", "harakirimail.com",
  "33mail.com", "anonbox.net", "getairmail.com", "jetable.org", "meltmail.com", "mailcatch.com", "mailnull.com", "trbvm.com",
]);

export function isDisposableEmail(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const at = raw.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const domain = raw.trim().toLowerCase().slice(at + 1);
  return DISPOSABLE_DOMAINS.has(domain) || [...DISPOSABLE_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}

/**
 * The answer keys of the fields a saved form DECLARES as email fields, or null when its field types are not known.
 * List Builder: `elements[]` (key = token, else the label upper-cased). Lead Generator: `fields[]` (key = label upper-cased,
 * duplicates get _2, _3 like the form). So a checkbox or dropdown that merely has "email" in its label is never treated as an address.
 */
export function declaredEmailKeys(config: Json | null | undefined): Set<string> | null {
  if (!config) return null;
  const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();
  const out = new Set<string>();
  if (Array.isArray(config.elements)) {
    for (const el of config.elements as Json[]) if (el?.type === "email") out.add(norm(el.token) || norm(el.label));
    return out;
  }
  if (Array.isArray(config.fields)) {
    const seen = new Map<string, number>();
    for (const f of config.fields as Json[]) {
      const base = norm(f?.label) || norm(f?.id) || "FIELD";
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      if (f?.type === "email") out.add(n === 1 ? base : `${base}_${n}`);
    }
    return out;
  }
  return null;
}

/**
 * A short, viewer-safe message when an email answer is not acceptable, else "". With `emailKeys` (from the saved form) only
 * those answers are checked; without it, every answer whose field name contains "email" is. With `blockDisposable` (an owner
 * setting) throwaway inboxes are refused too.
 */
export function emailProblem(data: Record<string, string>, opts: { blockDisposable?: boolean; emailKeys?: Set<string> | null } = {}): string {
  for (const [key, value] of Object.entries(data)) {
    const isEmail = opts.emailKeys ? opts.emailKeys.has(key.trim().toUpperCase()) : /e-?mail/i.test(key);
    if (!isEmail) continue;
    if (!isValidEmail(value)) return "Please enter a valid email address.";
    if (opts.blockDisposable && isDisposableEmail(value)) return "Please use a permanent email address.";
  }
  return "";
}

/** Valid addresses only, trimmed, de-duplicated ignoring case, at most MAX_NOTIFY_EMAILS. */
export function uniqueEmails(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw && typeof raw === "object" ? (raw as Json).value : raw; // List Builder extras may be { value }
    if (!isValidEmail(v)) continue;
    const addr = String(v).trim();
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
    if (out.length >= MAX_NOTIFY_EMAILS) break;
  }
  return out;
}

/**
 * Who to notify for a saved config (up to 3 people). Lead Generator clips use
 * emailNotificationEnabled + notificationEmail/2/3; the List Builder uses
 * emailEnabled + emailAddress/2/3. [] when notifications are off.
 */
export function savedNotifyEmails(config: Json | null | undefined, listBuilder = false): string[] {
  if (!config) return [];
  const on = listBuilder ? !!config.emailEnabled : !!config.emailNotificationEnabled;
  if (!on) return [];
  return uniqueEmails(listBuilder
    ? [config.emailAddress, config.emailAddress2, config.emailAddress3]
    : [config.notificationEmail, config.notificationEmail2, config.notificationEmail3]);
}

/** The first recipient ("" when none). */
export function savedNotifyEmail(config: Json | null | undefined, listBuilder = false): string {
  return savedNotifyEmails(config, listBuilder)[0] ?? "";
}

// ------------------------------------------------------------------------------------------------ chat alert presets
export type ChatPreset = "slack" | "discord" | "teams" | "teams-workflow";

/** Which chat app a webhook URL belongs to (so the alert is shaped the way that app needs), or null for a normal webhook. */
export function chatPreset(url: string): ChatPreset | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "hooks.slack.com" && u.pathname.startsWith("/services/")) return "slack";
  if ((host === "discord.com" || host === "discordapp.com" || host === "canary.discord.com" || host === "ptb.discord.com") && u.pathname.startsWith("/api/webhooks/")) return "discord";
  if ((host.endsWith(".webhook.office.com") || host === "outlook.office.com") && u.pathname.includes("/webhook")) return "teams"; // legacy Office 365 connector
  // Teams "Workflows" (Power Automate: "Post to a channel when a webhook request is received"), the replacement for connectors
  if ((host.endsWith(".logic.azure.com") && u.pathname.includes("/workflows/")) || (host.endsWith(".powerplatform.com") && u.pathname.includes("/workflows/"))) return "teams-workflow";
  return null;
}

const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

/** The words of a new-lead alert: a title, the answers (first 10) and where the lead came from. Plain text, no markup. */
export function leadAlertText(
  kind: string,
  data: Record<string, string>,
  attribution: { utm?: Record<string, string>; referrer?: string } = {},
): { title: string; lines: string[] } {
  const title = kind === "call-attempt" ? "Someone tried to call you" : kind === "list-builder" || kind === "personalizer" ? "New List Builder sign-up" : "New lead";
  const lines = Object.entries(data).slice(0, 10).map(([k, v]) => `${clip(k, 40)}: ${clip(String(v), 200)}`);
  const from = [attribution.utm?.source, attribution.utm?.campaign].filter(Boolean).join(" / ") || (attribution.referrer ? hostOf(attribution.referrer) : "");
  if (from) lines.push(`Came from: ${clip(from, 120)}`);
  return { title, lines };
}

/**
 * The JSON body for a chat preset. Slack needs `text` (with & < > escaped), Discord needs `content` (2,000 characters, no pings),
 * Teams needs a MessageCard. Every value is data from a viewer, so mentions are defused and nothing is treated as markup.
 */
export function chatBody(preset: ChatPreset, alert: { title: string; lines: string[] }): Record<string, unknown> {
  const safe = (t: string) => t.replace(/@(everyone|here|channel)\b/gi, "@\u200b$1"); // email addresses stay intact; only the ping words are defused
  if (preset === "slack") {
    const esc = (t: string) => safe(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return { text: [`*${esc(alert.title)}*`, ...alert.lines.map(esc)].join("\n") };
  }
  if (preset === "discord") {
    return { content: clip([`**${safe(alert.title)}**`, ...alert.lines.map(safe)].join("\n"), 2000), allowed_mentions: { parse: [] } };
  }
  if (preset === "teams-workflow") {
    // The Workflows trigger takes a message with an Adaptive Card attachment.
    return {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null,
        content: {
          type: "AdaptiveCard", $schema: "http://adaptivecards.io/schemas/adaptive-card.json", version: "1.4",
          body: [
            { type: "TextBlock", text: safe(alert.title), weight: "Bolder", size: "Medium", wrap: true },
            ...alert.lines.map((l) => ({ type: "TextBlock", text: safe(l), wrap: true, spacing: "Small" })),
          ],
        },
      }],
    };
  }
  return {
    "@type": "MessageCard", "@context": "https://schema.org/extensions", summary: safe(alert.title), themeColor: "22D3EE",
    title: safe(alert.title), text: alert.lines.map(safe).join("\n\n"),
  };
}

// ------------------------------------------------------------------------------------------------ auto-reply to the lead
export const AUTO_REPLY_DEFAULT_SUBJECT = "Thanks for signing up";
export const AUTO_REPLY_DEFAULT_BODY = "Hi {{first_name}}, thanks for signing up! Here is your video: {{video_link}}";

/** The owner's auto-reply, from the saved form: only when switched on; subject and body are plain text and capped. */
export function autoReplySettings(config: Json | null | undefined): { subject: string; body: string } | null {
  if (!config || config.autoReplyEnabled !== true) return null;
  const clean = (v: unknown, max: number, fallback: string) => {
    const t = typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "";
    return t || fallback;
  };
  return { subject: oneLine(clean(config.autoReplySubject, 120, AUTO_REPLY_DEFAULT_SUBJECT)), body: clean(config.autoReplyBody, 1000, AUTO_REPLY_DEFAULT_BODY) };
}

/** Where a lead's reply to the auto-reply goes: the owner's reply-to setting when it is a valid address, else the first notification address, else none. */
export function autoReplyReplyTo(config: Json | null | undefined, notifyTo: string[] = []): string {
  const own = typeof config?.autoReplyReplyTo === "string" ? config.autoReplyReplyTo.trim() : "";
  if (own && isValidEmail(own)) return own;
  return notifyTo[0] ?? "";
}

/**
 * The email itself. Only two things from outside the owner's words are put in: the lead's first name and the video link
 * (which we build). The name is escaped and capped; nothing the viewer typed can add links or markup. Plain, transactional.
 */
export function buildAutoReply(
  settings: { subject: string; body: string },
  { firstName = "", videoUrl = "" }: { firstName?: string; videoUrl?: string },
): { subject: string; html: string; text: string } {
  const name = oneLine(firstName.trim().split(/\s+/)[0] ?? "").slice(0, 40);
  const fill = (t: string, esc: (v: string) => string) =>
    t.replace(/\{\{\s*first_name\s*\}\}/gi, esc(name || "there")).replace(/\{\{\s*video_link\s*\}\}/gi, esc(videoUrl));
  const text = fill(settings.body, (v) => v);
  const html = `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${fill(escHtml(settings.body), (v) => escHtml(v))}</div>`;
  const subject = oneLine(fill(settings.subject, (v) => v).replace(/\{\{[^}]*\}\}/g, "").trim()) || AUTO_REPLY_DEFAULT_SUBJECT;
  return { subject, html, text };
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200);

/** Subject + bodies for a new-lead email. Every viewer-supplied value is escaped. */
export function buildLeadEmail(
  kind: string,
  data: Record<string, string>,
  attribution: { utm?: Record<string, string>; referrer?: string } = {},
): { subject: string; html: string; text: string } {
  const entries = Object.entries(data);
  const what = kind === "call-attempt" ? "Someone tried to call you" : kind === "list-builder" ? "New List Builder sign-up" : "New lead";
  const first = entries.find(([k]) => /MAIL/i.test(k))?.[1] ?? entries[0]?.[1] ?? "";
  const subject = oneLine(first ? `${what}: ${first}` : what);
  const row = ([k, v]: [string, string]) => `<tr><td style="padding:4px 12px 4px 0;color:#666"><b>${escHtml(k)}</b></td><td style="padding:4px 0">${escHtml(v)}</td></tr>`;
  const rows = entries.map(row).join("");
  // Where the lead came from (campaign tags and the referring site), shown below the answers.
  const src: Array<[string, string]> = [
    ...Object.entries(attribution.utm ?? {}).map(([k, v]): [string, string] => [`utm_${k}`, String(v)]),
    ...(attribution.referrer ? [["Referrer", attribution.referrer] as [string, string]] : []),
  ];
  const srcHtml = src.length ? `<h3 style="margin:16px 0 6px;font-size:13px;color:#666">Source</h3><table>${src.map(row).join("")}</table>` : "";
  return {
    subject,
    html: `<div style="font-family:system-ui,sans-serif"><h2 style="margin:0 0 12px">${escHtml(what)}</h2><table>${rows}</table>${srcHtml}</div>`,
    text: `${what}\n\n${entries.map(([k, v]) => `${k}: ${v}`).join("\n")}${src.length ? `\n\nSource\n${src.map(([k, v]) => `${k}: ${v}`).join("\n")}` : ""}`,
  };
}

/** Find the lead config (clip or List Builder) in a published project. */
export function leadConfigFor(project: Json, kind: string, clipId: string | null): { config: Json | null; listBuilder: boolean } {
  if (kind === "list-builder" || kind === "personalizer") {
    const lb = project.listBuilder && typeof project.listBuilder === "object" ? project.listBuilder as Json : null;
    return { config: lb && lb.enabled ? lb : null, listBuilder: true };
  }
  const tracks = Array.isArray(project.tracks) ? project.tracks as Json[] : [];
  for (const t of tracks) {
    const items = (Array.isArray(t.items) ? t.items : Array.isArray(t.clips) ? t.clips : []) as Json[];
    const clip = items.find((c) => String(c.id) === clipId && (kind === "call-attempt" ? isCallClip(c) : c.type === "lead-form"));
    if (clip) return { config: clip, listBuilder: false };
  }
  return { config: null, listBuilder: false };
}

