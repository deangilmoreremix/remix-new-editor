// [remix] Account-level Notification settings: alert preferences, quiet hours and the browser-push card belong to the
// owner, not to one video, so they must be reachable before anything is published. Reuses the Alerts view without a project.
import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { getClient } from '@cinegen/components/leads/use-publish';
// @ts-expect-error plain JS
import { notificationsTab } from '../../../lib/editor/projectLibrary/projectTabs.js';

export function AccountAlerts() {
  const { dispatch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!open || !host) return undefined;
    host.innerHTML = '';
    const panel = document.createElement('div');
    host.appendChild(panel);
    const deps = {
      getClient,
      navigate: () => {},
      onToast: (msg: string) => setToast(msg),
      onUnreadChanged: () => window.dispatchEvent(new Event('remix:notifications-changed')),
    };
    // No project: alert buttons that would open a video view send the owner to Publish & Leads instead.
    const ctx = { project: null, card: null, openTab: () => dispatch({ type: 'SET_TAB', tab: 'leads' }) };
    const r = notificationsTab(deps)(panel, ctx, {});
    return () => { try { if (typeof r === 'function') r(); } catch { /* already unmounted */ } };
  }, [open, dispatch]);

  return (
    <section className="cg-analytics__account" data-testid="account-alerts">
      <button type="button" className="cg-analytics__btn" aria-expanded={open} aria-controls="cg-account-alerts-panel" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide notification settings' : 'Notification settings'}
      </button>
      <p className="cg-analytics__hint">Choose which alerts you get, turn on browser push and set quiet hours. These apply to your whole account.</p>
      {toast && <p className="cg-analytics__toast" role="status">{toast}</p>}
      <div id="cg-account-alerts-panel" ref={hostRef} className="cg-analytics__host" hidden={!open} />
    </section>
  );
}
