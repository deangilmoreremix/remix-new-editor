/**
 * "Browser push notifications" card for the Alerts preferences. Plain DOM, styled with the analytics `sv-*`
 * classes. Hidden behind a short message when the site has no VAPID key; never throws.
 *
 *   mountPushCard(host, { getClient, pushEnabled, onPushPref, vapidKey?, env?, onToast? }) -> { destroy, ready }
 *   getClient()          Supabase client (verified identity) used for the owner_push_subscriptions row
 *   pushEnabled          current retarget_preferences.push value
 *   onPushPref(boolean)  persists retarget_preferences.push (rejects -> the toggle is put back)
 */
import { inspectPush, subscribe, unsubscribe, sendTestNotification, vapidKeyFromEnv } from './pushClient.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mountPushCard(host, { getClient, pushEnabled = false, onPushPref, vapidKey = vapidKeyFromEnv(), env = globalThis, onToast } = {}) {
  let alive = true; let busy = false; let info = null; let note = ''; let pref = !!pushEnabled;
  const card = host.ownerDocument.createElement('section');
  card.className = 'sv-card';
  card.setAttribute('data-push-card', '');
  card.setAttribute('aria-labelledby', 'sv-push-title');
  host.appendChild(card);

  const draw = () => {
    if (!alive) return;
    if (!info) { card.innerHTML = '<h3 id="sv-push-title">Browser push notifications</h3><p class="sv-subtitle" role="status">Checking this device...</p>'; return; }
    const usable = info.state === 'on' || info.state === 'off';
    const on = info.state === 'on';
    card.innerHTML = `<h3 id="sv-push-title">Browser push notifications</h3>
      <p class="sv-subtitle">Get an alert on this device even when the site is closed.</p>
      <p class="sv-hint" data-push-status role="status">${esc(note || info.message)}</p>
      ${usable ? `<div class="sv-toolbar-actions" style="justify-content:flex-start;flex-wrap:wrap;gap:8px;margin:8px 0">
        <button type="button" class="${on ? 'sv-secondary-btn' : 'sv-primary-btn'}" data-push-toggle ${busy ? 'disabled' : ''}>${on ? 'Disable on this device' : 'Enable on this device'}</button>
        ${on ? `<button type="button" class="sv-secondary-btn" data-push-test ${busy ? 'disabled' : ''}>Send test notification</button>` : ''}</div>` : ''}
      ${info.state === 'hidden' || info.state === 'unsupported' || info.state === 'no-service-worker' ? '' : `<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" name="push" ${pref ? 'checked' : ''}/> Send me push notifications for the alerts selected above</label>`}`;
    card.querySelector('[data-push-toggle]')?.addEventListener('click', onToggle);
    card.querySelector('[data-push-test]')?.addEventListener('click', onTest);
    card.querySelector('[name=push]')?.addEventListener('change', onPref);
  };

  const refresh = async () => { try { info = await inspectPush({ vapidKey, env }); } catch { info = { state: 'unsupported', message: 'Push notifications are not available here.' }; } draw(); };

  async function savePref(value) {
    const before = pref; pref = value;
    try { await onPushPref?.(value); } catch (err) { pref = before; note = err?.message || 'Could not save this setting.'; }
  }

  async function onToggle() {
    if (busy) return;
    busy = true; draw();
    try {
      if (info.state === 'on') {
        const r = await unsubscribe({ registration: info.registration, client: await getClient() });
        note = r.message;
      } else {
        // Permission is requested here, inside the click handler, never on page load.
        const r = await subscribe({ vapidKey, registration: info.registration, client: await getClient(), env });
        note = r.message;
        if (r.status === 'subscribed' && !pref) await savePref(true);
      }
    } catch (err) { note = err?.message || 'Something went wrong.'; }
    busy = false;
    await refresh();
  }

  async function onTest() {
    if (busy) return;
    const r = await sendTestNotification({ registration: info.registration, env });
    note = r.message; draw();
    if (r.status === 'error') onToast?.(r.message, 'error');
  }

  async function onPref(e) {
    const box = e.currentTarget;
    box.disabled = true;
    await savePref(box.checked);
    note = note || (pref ? 'Push alerts are on.' : 'Push alerts are off.');
    draw();
    note = '';
  }

  draw();
  const ready = refresh();
  return { ready, destroy() { alive = false; card.remove(); } };
}
