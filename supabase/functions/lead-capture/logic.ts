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

