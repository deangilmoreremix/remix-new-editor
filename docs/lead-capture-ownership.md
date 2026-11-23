# `lead-capture` edge function: ownership and deploy rules

Two apps use the same Supabase project (`VideoRemix Product`) and the same function:

| App | Repo | Uses `lead-capture` for |
|---|---|---|
| **Timeline Studio Editor** (`smartvid.app`) | `remix-new-editor` | Lead Generator / List Builder on published videos (`publishedId`), the editor's Leads tab (`list`, integrations, webhook tests) |
| **Personalization / landing pages** | `OpenHiggsBolt` | Landing-page leads (`pageId`), including a delivery-only call with the service key (`skipStore: true`) |

## Owner

**`remix-new-editor` owns the function.** The source is `supabase/functions/lead-capture/` in this repo, and this is the only repo that deploys it. `OpenHiggsBolt` only calls it and does not hold a copy.

## Rules

1. **Deploy only from here**, from a branch that has been tested (`npx vitest run supabase/functions src/test/lead-capture-*.test.js`).
2. **Before deploying, check the live version** (Supabase → Edge Functions → `lead-capture`, or `list_edge_functions`). If it is newer than the last version recorded in "Deploy history" below, somebody deployed from elsewhere: diff the live code against the repo and merge it in first. Do not overwrite it.
3. **Request shapes are a contract with both apps.** Do not change or remove these without checking the other app's callers:
   - `{ publishedId, clipId, kind, data, source, signals?, "cf-turnstile-response"? }`: published video lead.
   - `{ pageId, kind?, contactId?, data, source, skipStore? }`: landing page lead. `skipStore: true` is honoured only when the `Authorization` header is exactly the service-role key (a visitor can never use it).
   - `{ action: "list" | "integration-*" | "signing-secret" | "deliveries" | "test-webhooks", ... }`: signed-in editor actions.
4. Keep the function working before optional migrations are applied (it already falls back when `email_key` or the follow-up columns are missing).

## Deploy history

| Version | Date | From | Notes |
|---|---|---|---|
| v6 | before 2026-11-18 | unknown | older than this repo |
| v7 | 2026-11-18 | this repo | spam checks, MX check, dedupe, follow-up columns |
| v8 | 2026-11-18 | not this repo | added the landing-page branch (visual-editor pages, per-page rate limits, `landing_page_form_settings`, service-key delivery-only path). Source archived in `docs/archive/lead-capture-v8/` (saved as `.txt`) for rollback |
| v9 | 2026-11-19 | this repo | three-way merge of v7 + repo (`develop` chat alerts, auto-reply, guest handling) + v8 landing-page branch |
| v10, v11 | 2026-11-22 | not recorded | deployed by someone else; source not compared with the repo when this was written. Check the live version before the next deploy (rule 2) |

## Rolling back to v8

Copy `docs/archive/lead-capture-v8/index.ts.txt` and `logic.ts.txt` to `index.ts` / `logic.ts` and deploy with JWT verification **off** (viewers are anonymous). Note v8 lacks the `develop` chat alerts and auto-reply.

## Settings (Supabase → Edge Functions → Secrets)

Optional unless noted: `RESEND_API_KEY` + `LEAD_EMAIL_FROM` (lead emails), `PUBLIC_APP_URL` (auto-reply link), `WEBHOOK_SIGNING_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY` (Kit/MailerLite keys), `TURNSTILE_SECRET_KEY`, `LEAD_MX_CHECK`, `LEAD_EXTRA_DISPOSABLE_DOMAINS`, `LEAD_CAPTURE_ALLOWED_ORIGINS`.

## Still to verify (not testable without the other app)

A real landing-page lead from `OpenHiggsBolt`, and its delivery-only call, against version 9.
