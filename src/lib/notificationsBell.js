/**
 * Header notification bell: unread count for the signed-in owner's video alerts (owner_notifications).
 * Counts come from the owner-only RPC (row-level security), refreshed on load, when the tab regains focus and
 * every few minutes while visible. Nothing is shown for signed-out visitors. Clicking opens the Timeline Editor's
 * Projects panel on the project with the most unread alerts.
 *
 * Live updates: when `getRealtime` is supplied the bell also listens for new rows on owner_notifications over
 * Supabase Realtime (authenticated with the same verified token as the REST client). It bumps the badge at once and,
 * only while the page is visible, shows a small toast; a hidden page relies on Web Push. Any Realtime failure is
 * silent: the polling above keeps working and the channel is retried on the next check.
 */
export const OPEN_FLAG = 'remix_open_projects';

export function createNotificationsBell({ getClient, isSignedIn = () => !!globalThis.window?.Clerk?.user, navigate, intervalMs = 180000, doc = globalThis.document, getRealtime = null, realtimeCheckMs = 300000, toastMs = 6000, getCurrentUserId = null, identityCheckMs = 3000 }) {
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
    const hash = globalThis.location?.hash || '';
    if (/^#\/timeline-classic/.test(hash)) { try { sessionStorage.removeItem(OPEN_FLAG); } catch { /* ignore */ } globalThis.dispatchEvent(new CustomEvent('remix:open-projects')); }
    else if (/^#\/timeline(?![-\w])/.test(hash)) globalThis.dispatchEvent(new CustomEvent('remix:open-projects')); // the new editor listens too
    else navigate?.('timeline'); // opens the editor; its Analytics tab reads the flag and shows the alerts
  });

  // ---- Realtime (optional) ----
  // getRealtime() -> { client, userId, token } | null. A different token/user (refresh, sign-in, sign-out) re-subscribes.
  let rt = null; let rtBusy = false; let toastEl = null; let toastTimer = null;
  const showToast = (text) => {
    if (!alive || !doc.body) return;
    toastEl?.remove(); clearTimeout(toastTimer);
    toastEl = doc.createElement('div');
    toastEl.className = 'fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-zinc-900 text-white text-sm px-4 py-3 shadow-lg flex items-center gap-3';
    toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    const msg = doc.createElement('span'); msg.textContent = text;
    const view = doc.createElement('button'); view.type = 'button'; view.className = 'underline font-semibold'; view.textContent = 'View';
    view.addEventListener('click', () => { toastEl?.remove(); btn.click(); });
    toastEl.append(msg, view);
    doc.body.appendChild(toastEl);
    toastTimer = setTimeout(() => { toastEl?.remove(); toastEl = null; }, toastMs);
  };
  const onInsert = (payload) => {
    const row = payload?.new || {};
    if (!alive || row.read_at) return;
    count += 1; draw();                                    // immediate; the event below triggers the authoritative refresh
    globalThis.dispatchEvent?.(new CustomEvent('remix:notifications-changed'));
    if (doc.visibilityState === 'visible') {
      const title = String(row.title || row.summary || 'New alert').slice(0, 140);
      showToast(row.type === 'new_lead' && !/^new lead/i.test(title) ? `New lead: ${title}` : title);
    }
  };
  // An alert is only shown while the channel still belongs to the signed-in owner. After a sign-out or an account switch
  // the old channel can outlive the change until the next periodic check, so each alert re-checks who is signed in.
  // getCurrentUserId() is a synchronous source of the signed-in owner's id (when the host provides one), so a channel that
  // belongs to someone else is noticed immediately, without waiting for the asynchronous lookup below.
  const ownerChanged = (mine) => typeof getCurrentUserId === 'function' && (getCurrentUserId() || '') !== mine.userId;
  async function guardedInsert(payload, mine) {
    if (!alive || rt !== mine) return;
    if (!isSignedIn() || ownerChanged(mine)) { stopRealtime(); return; }              // signed out or another account: drop the channel now
    try {
      const info = await getRealtime();
      if (!alive || rt !== mine) return;
      if (!isSignedIn() || ownerChanged(mine) || !info?.userId || info.userId !== mine.userId) { stopRealtime(); return; } // changed while the lookup was pending
    } catch { return; }
    onInsert(payload);
  }
  async function stopRealtime() {
    const cur = rt; rt = null;
    try { if (cur?.client && cur.channel) await cur.client.removeChannel(cur.channel); } catch { /* already closed */ }
  }
  async function ensureRealtime() {
    if (!getRealtime || !alive || rtBusy) return;
    rtBusy = true;
    try {
      const info = isSignedIn() ? await getRealtime() : null;
      if (!alive) return;
      if (!info?.client || !info.userId) { await stopRealtime(); return; }
      if (rt && rt.userId === info.userId && rt.token === info.token) return;
      await stopRealtime();
      if (!alive) return; // destroyed while the old channel was being removed: do not open a new one
      const channel = info.client.channel(`owner-notifications-${info.userId}`);
      const mine = { client: info.client, channel, userId: info.userId, token: info.token };
      rt = mine;
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'owner_notifications', filter: `clerk_user_id=eq.${info.userId}` }, (payload) => guardedInsert(payload, mine))
        .subscribe((status) => {
          // Unauthorised / unavailable: drop the channel and let polling carry on; the next check retries.
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && rt === mine) stopRealtime();
        });
    } catch { await stopRealtime(); /* polling keeps working */ } finally { rtBusy = false; }
  }
  const onFocus = () => { refresh(); ensureRealtime(); };
  const onRead = () => refresh(true);
  globalThis.addEventListener?.('focus', onFocus);
  globalThis.addEventListener?.('remix:notifications-changed', onRead);
  timer = setInterval(() => { if (!doc.hidden) refresh(true); }, intervalMs);
  const rtTimer = getRealtime ? setInterval(ensureRealtime, realtimeCheckMs) : null;
  // A sign-out or account switch removes the channel within seconds, even when no alert arrives to trigger the check.
  const identityTimer = getRealtime && typeof getCurrentUserId === 'function'
    ? setInterval(() => { const cur = rt; if (cur && (!isSignedIn() || ownerChanged(cur))) { stopRealtime().then(() => ensureRealtime()); } }, identityCheckMs)
    : null;
  refresh(true); ensureRealtime();
  // Clerk usually finishes loading after the header is created: re-check a few times so a signed-in owner sees the bell soon.
  [1500, 4000, 9000].forEach((ms) => setTimeout(() => { if (alive && !isSignedIn()) return; refresh(true); ensureRealtime(); }, ms));
  return { element: btn, refresh: () => refresh(true), destroy() { alive = false; clearInterval(timer); clearInterval(rtTimer); clearInterval(identityTimer); clearTimeout(toastTimer); toastEl?.remove(); stopRealtime(); globalThis.removeEventListener?.('focus', onFocus); globalThis.removeEventListener?.('remix:notifications-changed', onRead); }, _count: () => count };
}
