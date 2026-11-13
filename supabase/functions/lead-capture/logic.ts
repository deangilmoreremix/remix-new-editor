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
  const email = entries.find(([k, v]) => /MAIL/i.test(k) && isValidEmail(v))?.[1];
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

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200);

/** Subject + bodies for a new-lead email. Every viewer-supplied value is escaped. */
export function buildLeadEmail(kind: string, data: Record<string, string>): { subject: string; html: string; text: string } {
  const entries = Object.entries(data);
  const what = kind === "call-attempt" ? "Someone tried to call you" : kind === "list-builder" ? "New List Builder sign-up" : "New lead";
  const first = entries.find(([k]) => /MAIL/i.test(k))?.[1] ?? entries[0]?.[1] ?? "";
  const subject = oneLine(first ? `${what}: ${first}` : what);
  const rows = entries.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666"><b>${escHtml(k)}</b></td><td style="padding:4px 0">${escHtml(v)}</td></tr>`).join("");
  return {
    subject,
    html: `<div style="font-family:system-ui,sans-serif"><h2 style="margin:0 0 12px">${escHtml(what)}</h2><table>${rows}</table></div>`,
    text: `${what}\n\n${entries.map(([k, v]) => `${k}: ${v}`).join("\n")}`,
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

