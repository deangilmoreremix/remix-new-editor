// src/components/UpgradePrompt.js
//
// The upgrade screen every studio opens when someone without SmartVideo full access tries a paid action
// (src/lib/clerkEntitlements.js requireEntitlement). It shows Clerk Billing's pricing table so they can buy without
// leaving; signed-out visitors are asked to sign in first. Closing it checks access again, so a purchase made here
// unlocks straight away. Resolves to true when the viewer has full access afterwards.
import { hasPaidAccess, setEntitlement } from '../lib/clerkEntitlements.js';

const el = (tag, cls = '', txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

let open = null;

export default function UpgradePrompt({ feature = 'this feature', clerk = globalThis.window?.Clerk } = {}) {
  if (open) return open.done;
  const overlay = el('div', 'fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-black/75 p-4 md:items-center');
  overlay.setAttribute('data-upgrade', '');
  const box = el('div', 'flex w-full max-w-4xl flex-col gap-5 rounded-2xl border border-white/10 bg-[#0b0c10] p-6 text-white shadow-2xl');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Unlock SmartVideo full access');
  const head = el('div', 'flex items-start justify-between gap-4');
  const words = el('div', 'flex flex-col gap-1.5');
  words.append(
    el('h2', 'text-2xl font-extrabold tracking-tight', 'Unlock SmartVideo full access'),
    el('p', 'text-sm text-white/60', `You can look around freely. To use ${feature}, upgrade to full access: every studio, Video Outreach with personal videos for each prospect, landing pages and more.`),
  );
  const x = el('button', 'rounded-lg px-2 py-1 text-xl leading-none text-white/60 hover:text-white', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close');
  head.append(words, x);
  const body = el('div', 'min-h-[120px]');
  box.append(head, body);
  overlay.appendChild(box);

  let mounted = null;
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const signedIn = !!clerk?.user;
  if (!signedIn) {
    body.appendChild(el('p', 'mb-4 text-sm text-white/70', 'Sign in first, then pick your plan.'));
    const b = el('button', 'rounded-[10px] border border-white/[0.14] border-l-2 border-l-primary bg-transparent px-5 py-2.5 text-sm font-bold text-white hover:bg-white/[0.05]', 'Sign in');
    b.type = 'button';
    b.setAttribute('data-upgrade-signin', '');
    b.addEventListener('click', () => {
      close();
      if (typeof clerk?.openSignIn === 'function') clerk.openSignIn();
      else globalThis.location.assign('/signin');
    });
    body.appendChild(b);
  } else if (typeof clerk?.mountPricingTable === 'function') {
    // Clerk's own table: plans, prices and checkout (it draws its own light card).
    const host = el('div', 'rounded-xl bg-white p-3 text-black');
    host.setAttribute('data-upgrade-pricing', '');
    body.appendChild(host);
    try { clerk.mountPricingTable(host, { newSubscriptionRedirectUrl: globalThis.location?.href }); mounted = host; }
    catch { host.replaceWith(el('p', 'text-sm text-amber-300', 'The plans could not be shown right now. Try again in a moment, or contact support.')); }
  } else {
    const p = el('p', 'text-sm text-amber-300', 'The plans could not be shown right now. Try again in a moment, or contact support.');
    p.setAttribute('data-upgrade-unavailable', '');
    body.appendChild(p);
  }

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  async function close() {
    if (!open) return;
    open = null;
    document.removeEventListener('keydown', onKey, true);
    if (mounted) { try { clerk.unmountPricingTable?.(mounted); } catch { /* already gone */ } }
    overlay.remove();
    // A purchase made in the table: refresh the session and check again.
    try { await clerk?.session?.reload?.(); } catch { /* offline: keep what we know */ }
    const paid = hasPaidAccess(clerk);
    if (paid) setEntitlement({ hasFullAccess: true });
    resolve(paid);
  }
  x.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  open = { done, close };
  return done;
}
