# Warmbly Studio

Standalone cold-email and warmup studio: campaigns, unified inbox, CRM, warmup, deliverability, automations, integrations.
Based on the feature set of [warmbly/warmbly](https://github.com/warmbly/warmbly) (Apache-2.0), rebuilt as a front-end studio
that runs today against a **local sandbox** and switches to the real Warmbly backend by swapping one adapter.

## Run the tests

```bash
cd apps/warmbly-studio && npm install && npm test && npm run typecheck
```

(This package is intentionally not a root npm workspace, so it never affects the root lockfile.)

## Use it

```tsx
import { WarmblyStudio } from '@smartvideo/warmbly-studio';
<WarmblyStudio />                       // local sandbox (localStorage, seeded demo data)
<WarmblyStudio adapter={myAdapter} />   // real backend
```

## What works now (no backend)

| Area | Behaviour |
|---|---|
| Campaigns | Multi-step sequences (email / wait / condition / task), spintax + `{{var \| fallback}}`, live preview, spam check, per-mailbox caps, send windows, stop-on-reply, launch/pause/duplicate, per-campaign analytics |
| Inbox | Unified threads, filters/search, labels, star/archive/unread, AI-draft reply (rule-based stand-in), send reply |
| CRM | Contacts (CSV import/export, tags, bulk actions, dedupe), deal pipeline with drag-and-drop, tasks, meetings |
| Warmup | Per-mailbox ramp, target volume, health score, DNS (SPF/DKIM/DMARC) checklist |
| Deliverability | Bounce/complaint rates, alerts, auto-pause suggestion, suppression list |
| Automations | Visual reply playbooks: trigger, conditions, actions (label, tag, task, deal, webhook, AI draft, unsubscribe) |
| Integrations | App connectors, webhooks (test), REST API keys (shown once) |
| Realtime | Subscription-driven updates, new-reply notification, team presence |

A local simulation engine (`src/api/engine.ts`) sends, opens, replies and warms up on a simulated clock; use **Simulate +1 day** on the dashboard.

## Connecting the backend later

The UI only talks to `WarmblyAdapter` (`src/api/actions.ts`):

```ts
interface WarmblyAdapter {
  kind: 'local' | 'remote';
  load(): Promise<Workspace>;                 // initial state
  dispatch(action: Action): Promise<Workspace>; // every mutation is one typed command
  subscribe(fn): () => void;                  // realtime pushes (Warmbly realtime service)
  now(): Date;
}
```

To go live: implement `createRemoteAdapter(baseUrl, token)` that maps each `Action` (see the `Action` union: `campaign/save`, `thread/reply`, `mailbox/warmup`, …) to the matching Warmbly REST endpoint, hydrates `Workspace` from the API, and feeds `subscribe` from its websocket. No UI code changes. The domain logic in `src/domain/*` (templating, sequencing, warmup ramp, scoring, automation rules) is pure and can also be used for client-side validation and previews.
