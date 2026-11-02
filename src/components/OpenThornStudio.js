// Smart Website Builder Studio — embedded iframe wrapper for the Website Builder app
// (the apps/openthorn sub-app). It always opens on the builder Dashboard.
// In dev, this points at a separate Vite dev server on :5173.
// In production, it loads the static build from /openthorn/.
//
// Access: anyone signed in to SmartVideo on a paid plan (Clerk feature
// `smartvideo_full_access`, or legacy_access) gets in automatically. The
// builder signs itself in with the same account through
// netlify/functions/website-builder-session.js, which re-checks payment on
// the server, so this client-side gate is only for a fast, friendly message.

import { PAID_FEATURE } from '../lib/clerkEntitlements.js';

const isDev = import.meta.env.DEV;
const OPENTHORN_DEV_URL = 'http://localhost:5173/dashboard';
const OPENTHORN_PROD_PATH = '/openthorn/dashboard';
const PRICING_URL = 'https://videoremix.io/smartvideo-pricing-page/';
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

function createHeader() {
  const header = document.createElement('div');
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:#050505;border-bottom:1px solid #27272a;
    flex-shrink:0;
  `;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="width:8px;height:8px;border-radius:50%;background:#d9ff00;box-shadow:0 0 8px rgba(217,255,0,0.45);"></span>
      <span style="color:#fff;font-weight:600;font-size:14px;${FONT}">Smart Website Builder</span>
      <span style="color:#a1a1aa;font-size:12px;${FONT}">Bring your own AI key</span>
    </div>
  `;
  return header;
}

function createIframe() {
  const iframe = document.createElement('iframe');
  iframe.src = isDev ? OPENTHORN_DEV_URL : OPENTHORN_PROD_PATH;
  iframe.style.cssText = 'flex:1;width:100%;border:none;background:#050505;display:block;';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation');
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
  container.appendChild(createHeader());

  // Local dev talks to the standalone sub-app dev server; no Clerk gate.
  if (isDev) {
    container.appendChild(createIframe());
    return container;
  }

  const loading = createNotice({ title: 'Loading Website Builder…' });
  container.appendChild(loading);

  resolveAccess().then((access) => {
    let next;
    if (access === 'paid') {
      next = createIframe();
    } else if (access === 'signed_out') {
      next = createNotice({
        title: 'Sign in to use Smart Website Builder',
        text: 'Smart Website Builder uses your SmartVideo account.',
        actionLabel: 'Sign in',
        onAction: () => { window.location.href = '/signin'; },
      });
    } else {
      next = createNotice({
        title: 'Included with SmartVideo Pro',
        text: 'Smart Website Builder is available to SmartVideo customers on a paid plan.',
        actionLabel: 'View plans',
        onAction: () => { window.open(PRICING_URL, '_blank', 'noopener'); },
      });
    }
    loading.replaceWith(next);
  });

  return container;
}
