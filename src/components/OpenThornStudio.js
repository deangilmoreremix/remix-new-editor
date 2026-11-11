// Smart Website Builder Studio — embedded iframe wrapper for the Website Builder app
// (the apps/openthorn sub-app). It always opens on the builder Dashboard.
// In dev, this points at a separate Vite dev server on :5173.
// In production, it loads the static build from /openthorn/.
//
// Access: anyone signed in to SmartVideo gets in automatically, paid or not,
// and lands straight on the builder dashboard. The builder signs itself in
// with the same account through netlify/functions/website-builder-session.js.

import { PAID_FEATURE } from '../lib/clerkEntitlements.js';
import { createEditorBanner } from '../lib/thumbnails.js';

const isDev = import.meta.env.DEV;
const OPENTHORN_DEV_URL = 'http://localhost:5173/dashboard';
const OPENTHORN_PROD_PATH = '/openthorn/dashboard';
const FONT = 'font-family:Inter,system-ui,sans-serif;';

/** @returns {'signed_out' | 'unpaid' | 'paid'} */
export function builderAccess(clerk) {
  if (!clerk?.user || !clerk?.session) return 'signed_out';
  let paid;
  try {
    paid = clerk.session.checkAuthorization?.({ feature: PAID_FEATURE }) === true;
  } catch {
    paid = false;
  }
  if (clerk.user.publicMetadata?.legacy_access === true) paid = true;
  return paid ? 'paid' : 'unpaid';
}

function createIframe() {
  const iframe = document.createElement('iframe');
  iframe.src = isDev ? OPENTHORN_DEV_URL : OPENTHORN_PROD_PATH;
  iframe.style.cssText = 'flex:1;width:100%;border:none;background:#050505;display:block;';
  iframe.setAttribute('loading', 'lazy');
  // allow-downloads: "Download code" (ZIP) would otherwise be blocked.
  // allow-popups-to-escape-sandbox: links to a deployed site open as normal tabs.
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-top-navigation-by-user-activation');
  // Copy buttons (share links, code) and fullscreen preview.
  iframe.setAttribute('allow', 'clipboard-write; fullscreen');
  iframe.setAttribute('title', 'Smart Website Builder');
  return iframe;
}

function createNotice({ title, text, actionLabel, onAction }) {
  const wrap = document.createElement('div');
  wrap.setAttribute('data-builder-gate', '');
  wrap.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;padding:24px;background:#050505;';
  const card = document.createElement('div');
  card.style.cssText = `max-width:400px;width:100%;text-align:center;padding:40px 32px;background:#0a0a0a;border:1px solid #27272a;border-radius:16px;${FONT}`;
  const h = document.createElement('h2');
  h.textContent = title;
  h.style.cssText = 'color:#fff;font-size:20px;font-weight:700;margin:0 0 8px;';
  card.appendChild(h);
  if (text) {
    const p = document.createElement('p');
    p.textContent = text;
    p.style.cssText = 'color:#a1a1aa;font-size:14px;line-height:1.5;margin:0 0 24px;';
    card.appendChild(p);
  }
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = actionLabel;
    btn.style.cssText = 'width:100%;padding:11px 16px;border:none;border-radius:8px;background:#d9ff00;color:#050505;font-weight:600;font-size:14px;cursor:pointer;';
    btn.addEventListener('click', onAction);
    card.appendChild(btn);
  }
  wrap.appendChild(card);
  return wrap;
}

async function resolveAccess() {
  try {
    const { ensureClerkLoaded } = await import('../lib/clerkInit.js');
    const clerk = await ensureClerkLoaded();
    return builderAccess(clerk || window.Clerk);
  } catch (err) {
    console.warn('[WebsiteBuilder] Could not load Clerk:', err?.message || err);
    return builderAccess(window.Clerk);
  }
}

export function OpenThornStudio() {
  const container = document.createElement('div');
  container.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;background:#050505;';
  // The banner replaces the old thin title row (same title and "bring your own key" note).
  container.appendChild(createEditorBanner('website-builder', 'Smart Website Builder', 'Build a full website from a prompt. Bring your own AI key.'));

  // Local dev talks to the standalone sub-app dev server; no Clerk gate.
  if (isDev) {
    container.appendChild(createIframe());
    return container;
  }

  const loading = createNotice({ title: 'Loading Website Builder…' });
  container.appendChild(loading);

  resolveAccess().then((access) => {
    // Free and paid SmartVideo accounts both get the builder.
    const next = access === 'signed_out'
      ? createNotice({
          title: 'Sign in to use Smart Website Builder',
          text: 'Smart Website Builder uses your SmartVideo account.',
          actionLabel: 'Sign in',
          onAction: () => { window.location.href = '/signin'; },
        })
      : createIframe();
    loading.replaceWith(next);
  });

  return container;
}
