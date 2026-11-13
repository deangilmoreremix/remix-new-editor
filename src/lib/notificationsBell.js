/**
 * Header notification bell: unread count for the signed-in owner's video alerts (owner_notifications).
 * Counts come from the owner-only RPC (row-level security), refreshed on load, when the tab regains focus and
 * every few minutes while visible. Nothing is shown for signed-out visitors. Clicking opens the Timeline Editor's
 * Projects panel on the project with the most unread alerts.
 */
export const OPEN_FLAG = 'remix_open_projects';

export function createNotificationsBell({ getClient, isSignedIn = () => !!globalThis.window?.Clerk?.user, navigate, intervalMs = 180000, doc = globalThis.document }) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'hidden relative p-2 text-secondary hover:text-white transition-colors';
  btn.setAttribute('aria-label', 'Video alerts');
  btn.title = 'Video alerts';
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
  const badge = doc.createElement('span');
  badge.className = 'hidden absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center';
  badge.setAttribute('role', 'status');
  btn.appendChild(badge);

  let count = 0; let last = 0; let alive = true; let timer = null;
  const draw = () => {
    btn.classList.toggle('hidden', !isSignedIn());
    badge.classList.toggle('hidden', count <= 0);
    badge.textContent = count > 99 ? '99+' : String(count);
    btn.setAttribute('aria-label', count > 0 ? `Video alerts, ${count} unread` : 'Video alerts');
  };
  async function refresh(force = false) {
    if (!alive || !isSignedIn()) { count = 0; draw(); return count; }
    if (!force && Date.now() - last < 30000) return count;
    last = Date.now();
    try {
      const client = await getClient();
      const { data, error } = await client.rpc('owner_unread_notifications');
      count = error ? count : Math.max(0, Number(data) || 0);
    } catch { /* keep the previous count; the bell is informational */ }
    draw();
    return count;
  }
  btn.addEventListener('click', () => {
    try { sessionStorage.setItem(OPEN_FLAG, '1'); } catch { /* the event below still works on the editor page */ }
    if (/^#\/timeline-classic/.test(globalThis.location?.hash || '')) { try { sessionStorage.removeItem(OPEN_FLAG); } catch { /* ignore */ } globalThis.dispatchEvent(new CustomEvent('remix:open-projects')); }
    else navigate?.('timeline-classic'); // the editor that hosts Projects (develop serves the new CineGen editor at #/timeline)
  });
  const onFocus = () => refresh();
  const onRead = () => refresh(true);
  globalThis.addEventListener?.('focus', onFocus);
  globalThis.addEventListener?.('remix:notifications-changed', onRead);
  timer = setInterval(() => { if (!doc.hidden) refresh(true); }, intervalMs);
  refresh(true);
  // Clerk usually finishes loading after the header is created: re-check a few times so a signed-in owner sees the bell soon.
  [1500, 4000, 9000].forEach((ms) => setTimeout(() => { if (alive && !isSignedIn()) return; refresh(true); }, ms));
  return { element: btn, refresh: () => refresh(true), destroy() { alive = false; clearInterval(timer); globalThis.removeEventListener?.('focus', onFocus); globalThis.removeEventListener?.('remix:notifications-changed', onRead); }, _count: () => count };
}
