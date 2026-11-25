// supabase/functions/outreach-alerts
//
// Delivers Video Outreach alerts ("Mike Ross watched your video", "… clicked your booking button") by email
// (Resend, the same setup as lead-capture) and Slack (an incoming webhook the owner pasted in). The database
// trigger public._on_outreach_event queues each alert in outreach_alert_queue and calls this function; a cron
// job calls it again every 10 minutes for retries.
//
// It takes no input: it only sends what is already queued, using the service role. Anyone calling it can at
// most make queued alerts go out sooner, so it runs without a JWT (verify_jwt = false).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("OUTREACH_ALERT_FROM") ?? Deno.env.get("LEAD_EMAIL_FROM") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://smartvid.app";
const BATCH = 20;
const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 8000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function post(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) return new Response(JSON.stringify({ error: "not configured" }), { status: 500 });
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: rows, error } = await db.from("outreach_alert_queue").select("id, clerk_user_id, title, summary, attempts")
    .eq("status", "pending").order("created_at").limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let sent = 0;
  for (const r of rows ?? []) {
    const { data: prefs } = await db.from("outreach_alert_settings").select("enabled, email, slack_webhook").eq("clerk_user_id", r.clerk_user_id).maybeSingle();
    if (!prefs?.enabled || (!prefs.email && !prefs.slack_webhook)) {
      await db.from("outreach_alert_queue").update({ status: "skipped" }).eq("id", r.id);
      continue;
    }
    const errors: string[] = [];
    const link = `${APP_URL}/#/outreach`;
    if (prefs.email) {
      if (!RESEND_API_KEY || !EMAIL_FROM) errors.push("email is not configured");
      else {
        const res = await post("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: EMAIL_FROM, to: [prefs.email], subject: r.title,
            text: `${r.summary}\n\nSee who watched: ${link}`,
            html: `<p>${esc(r.summary)}</p><p><a href="${esc(link)}">See who watched in SmartVideo</a></p>`,
          }),
        }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as Response));
        if (!res.ok) errors.push(`email: HTTP ${res.status}`);
      }
    }
    if (prefs.slack_webhook && /^https:\/\/hooks\.slack\.com\/services\//.test(prefs.slack_webhook)) {
      const res = await post(prefs.slack_webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `*${r.title}*\n${r.summary}\n<${link}|See who watched>` }) })
        .catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as Response));
      if (!res.ok) errors.push(`slack: HTTP ${res.status}`);
    }
    const attempts = (r.attempts ?? 0) + 1;
    if (!errors.length) { sent += 1; await db.from("outreach_alert_queue").update({ status: "sent", sent_at: new Date().toISOString(), attempts }).eq("id", r.id); }
    else await db.from("outreach_alert_queue").update({ status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts, last_error: errors.join("; ").slice(0, 300) }).eq("id", r.id);
  }
  return new Response(JSON.stringify({ processed: rows?.length ?? 0, sent }), { headers: { "Content-Type": "application/json" } });
});
