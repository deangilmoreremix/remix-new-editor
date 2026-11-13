// [remix] ANALYTICS tab: what happened after a video was published — plays, watch time, retention, buttons and forms,
// audience segments, Retarget suggestions and owner alerts. It reuses the Timeline Editor's Projects views (plain DOM +
// React islands, all figures from owner-only Supabase functions) on top of the same published video this project's
// Leads tab publishes.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { usePublished, getClient } from '@cinegen/components/leads/use-publish';
import { buildPublishState } from '@cinegen/lib/leads/publish-state';
import { PublishedOverview } from '@cinegen/components/projects/published-overview';
import { ensureProjectRow, linkVideoToProject, linkedProjectId, rowName } from '@cinegen/lib/leads/project-link';
// @ts-expect-error plain JS
import { audienceTab, retargetTab, notificationsTab } from '../../../lib/editor/projectLibrary/projectTabs.js';
// @ts-expect-error plain JS
import { mountAnalyticsTab } from '../../../lib/editor/projectLibrary/analytics/mountAnalyticsTab.jsx';
import '../../../../styles/smartvideo-analytics.css';
import '../../../../styles/projects-panel.css';
import '../../styles/analytics-tab.css';

type View = 'analytics' | 'audience' | 'retarget' | 'notifications';
const VIEWS: [View, string][] = [['analytics', 'Analytics'], ['audience', 'Audience'], ['retarget', 'Retarget'], ['notifications', 'Alerts']];
const OPEN_FLAG = 'remix_open_projects'; // set by the header bell

export function AnalyticsTab() {
  const { state, projectId, dispatch } = useWorkspace();
  const pub = usePublished();
  const [view, setView] = useState<View>('analytics');
  const [opts, setOpts] = useState<Record<string, unknown>>({});
  const [linked, setLinked] = useState<'checking' | 'ok' | 'unavailable'>('checking');
  const [toast, setToast] = useState('');
  const [rowId, setRowId] = useState<string | null>(null); // this timeline's project row (one per published timeline)
  const [retry, setRetry] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const tl = state.timelines.find((t) => t.id === state.activeTimelineId) ?? state.timelines[0];
  const latest = useRef({ tl, state, title: pub.title }); latest.current = { tl, state, title: pub.title };

  const openView = useCallback((v: View, o: Record<string, unknown> = {}) => { setOpts(o); setView(v); }, []);

  // The header bell opens the alerts for the project that is open.
  useEffect(() => {
    try { if (sessionStorage.getItem(OPEN_FLAG)) { sessionStorage.removeItem(OPEN_FLAG); setView('notifications'); } } catch { /* storage unavailable */ }
  }, []);

  // Bell clicked while this tab is already open: the shell only re-selects this tab, so switch the sub-view here too.
  useEffect(() => {
    const open = () => { try { sessionStorage.removeItem(OPEN_FLAG); } catch { /* ignore */ } setOpts({}); setView('notifications'); };
    window.addEventListener('remix:open-projects', open);
    return () => window.removeEventListener('remix:open-projects', open);
  }, []);

  // Make sure the published video is tied to this project (older publications were not).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pub.loaded) return;
      if (!pub.info || !pub.id) { setLinked('unavailable'); return; }
      const { tl: t0 } = latest.current;
      if (!projectId || !t0?.id) { setLinked('unavailable'); return; }
      try {
        const id = await linkedProjectId(projectId, t0.id);
        const client = await getClient();
        const { tl: t, state: s, title } = latest.current;
        const built = buildPublishState(t, s.assets, s.overlays ?? [], title);
        await ensureProjectRow(client, { projectId: id, name: await rowName(projectId, title), built, aspect: t?.aspect ?? null, cinegenProjectId: projectId, timelineId: t0.id });
        await linkVideoToProject(client, pub.id, id);
        if (!cancelled) { setRowId(id); setLinked('ok'); }
      } catch (e) { if (!cancelled) { setToast((e as Error).message); setLinked('unavailable'); } }
    })();
    return () => { cancelled = true; };
  }, [pub.loaded, pub.info, pub.id, projectId, tl?.id, retry]);

  // Mount the selected view into the host element.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || linked !== 'ok' || !rowId) return undefined;
    host.innerHTML = '';
    const panel = document.createElement('div');
    host.appendChild(panel);
    const ctx = { project: { id: rowId, name: latest.current.title, videoId: pub.id }, card: { id: rowId, published: true, publishedId: pub.id }, openTab: (v: View, o?: Record<string, unknown>) => openView(v, o) };
    const deps = {
      getClient,
      navigate: (page: string) => import('../../../lib/router.js').then((m) => m.navigate(page)),
      onToast: (msg: string) => setToast(msg),
      onUnreadChanged: () => window.dispatchEvent(new Event('remix:notifications-changed')),
    };
    let stop: (() => void) | null = null; let cancelled = false;
    if (view === 'analytics') {
      getClient().then((client) => {
        if (cancelled) return;
        stop = mountAnalyticsTab(panel, ctx, {
          client,
          onPublish: () => dispatch({ type: 'SET_TAB', tab: 'leads' }),
          onOpenOpportunity: (id: string) => openView('notifications', { focusId: id }),
          onCreateFollowup: () => openView('retarget'),
        });
      }).catch((e: Error) => { panel.textContent = e.message; });
    } else {
      const render = view === 'audience' ? audienceTab(deps) : view === 'retarget' ? retargetTab(deps) : notificationsTab(deps);
      const r = render(panel, ctx, opts);
      if (typeof r === 'function') stop = r;
    }
    return () => { cancelled = true; try { stop?.(); } catch { /* already unmounted */ } };
  }, [view, opts, linked, rowId, pub.id, dispatch, openView]);

  const empty = (title: string, text: string) => (
    <>
      <div className="cg-analytics__empty"><h3>{title}</h3><p>{text}</p>
        <button type="button" className="cg-analytics__btn" onClick={() => dispatch({ type: 'SET_TAB', tab: 'leads' })}>Open Publish &amp; Leads</button></div>
      {/* Not published yet: still show how all your published videos are doing. */}
      {pub.signedIn && <PublishedOverview onPublish={() => dispatch({ type: 'SET_TAB', tab: 'leads' })} />}
    </>
  );
  const failed = (text: string) => (
    <div className="cg-analytics__empty" role="alert"><h3>Analytics is not available for this project yet</h3><p>{text}</p>
      <button type="button" className="cg-analytics__btn" onClick={() => { setToast(''); setLinked('checking'); setRetry((n) => n + 1); }}>Try again</button></div>
  );

  return (
    <div className="cg-analytics" data-testid="analytics-tab">
      {!pub.signedIn ? empty('Sign in to see analytics', 'Viewer data belongs to your account.')
        : !pub.loaded || linked === 'checking' ? <div className="cg-analytics__empty" aria-busy="true"><p>Loading…</p></div>
        : !pub.info ? empty('Publish this video first', 'Viewer data is collected on the published video page. Publish it, share the link, and plays, watch time, clicks and forms show up here.')
        : linked === 'unavailable' ? failed(toast || 'This project could not be linked to its published video.')
        : (
          <>
            <div className="cg-analytics__tabs" role="tablist">
              {VIEWS.map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={view === k} className={`cg-analytics__tab${view === k ? ' is-active' : ''}`} onClick={() => openView(k)}>{l}</button>
              ))}
            </div>
            {toast && <p className="cg-analytics__toast" role="status">{toast}</p>}
            <div ref={hostRef} className="cg-analytics__host" />
          </>
        )}
    </div>
  );
}
