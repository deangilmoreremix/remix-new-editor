// [remix] Dependencies for the Projects overview (cards, headline stats, per-project dashboards) inside the new
// editor. It is the same panel the classic editor uses; this only supplies CineGen's wiring: which rows to list
// (projects published from this editor), how to open one, and the owner-only Supabase queries behind the numbers.
import { getClient } from '@cinegen/components/leads/use-publish';
// @ts-expect-error plain JS
import { audienceTab, retargetTab, notificationsTab } from '../../../lib/editor/projectLibrary/projectTabs.js';
// @ts-expect-error plain JS
import { mountAnalyticsTab } from '../../../lib/editor/projectLibrary/analytics/mountAnalyticsTab.jsx';
// @ts-expect-error plain JS
import { periodRange } from '../../../lib/editor/projectLibrary/analytics/analyticsData.js';
// @ts-expect-error plain JS
import { unreadCount } from '../../../lib/editor/projectLibrary/tabsData.js';

type Row = { id: string; settings?: { source?: string; cinegenProjectId?: string } | null };
/** Fired when a card is opened while a project is already open (the app shell switches projects). */
export const OPEN_PROJECT_EVENT = 'remix:cinegen-open-project';

export function createOverviewDeps(o: { onOpenProject: (cinegenProjectId: string) => void; onToast?: (msg: string, kind?: string) => void; onPublish?: () => void }) {
  const toast = o.onToast ?? (() => {});
  const open = (row?: Row) => {
    const id = row?.settings?.cinegenProjectId;
    if (id) o.onOpenProject(id); else toast('Open this project from the Projects list', 'info');
  };
  const tabDeps = {
    getClient,
    navigate: (page: string) => import('../../../lib/router.js').then((m) => m.navigate(page)),
    onToast: toast,
    onUnreadChanged: () => window.dispatchEvent(new Event('remix:notifications-changed')),
  };
  return {
    getClient,
    getCurrentProjectId: () => null,
    filterRows: (rows: Row[]) => rows.filter((r) => r.settings?.source === 'cinegen'),
    async getPublished(ids: string[]) {
      if (!ids.length) return {};
      const client = await getClient();
      const me = (window as unknown as { Clerk?: { user?: { id?: string } } }).Clerk?.user?.id;
      const { data } = await client.from('published_videos').select('id, published, project_id, clerk_user_id').in('project_id', ids);
      const out: Record<string, unknown> = {};
      for (const v of data || []) if (v.clerk_user_id === me && v.project_id) out[v.project_id] = v;
      return out;
    },
    onCreate: () => toast('Create a project from the Projects list, publish it from Leads, and it appears here', 'info'),
    onOpen: open,
    onPreview: open,
    onExport: open,
    onShare: open,
    onToast: toast,
    async getStats(ids: string[]) {
      const client = await getClient();
      const { from, to } = periodRange('30d');
      const { data, error } = await client.rpc('owner_video_stats', { p_from: from, p_to: to });
      if (error) throw error;
      const notes = await client.from('owner_notifications').select('project_id, type').is('read_at', null).in('project_id', ids);
      const unread: Record<string, number> = {}; const follow: Record<string, boolean> = {};
      for (const n of notes.data || []) { unread[n.project_id] = (unread[n.project_id] || 0) + 1; if (['followup_opportunity', 'high_interest'].includes(n.type)) follow[n.project_id] = true; }
      const out: Record<string, unknown> = {};
      for (const r of data || []) {
        if (!r.project_id) continue;
        const plays = Number(r.plays) || 0; const uniq = Number(r.unique_viewers) || 0;
        out[r.project_id] = {
          plays, unique_viewers: plays > 0 && uniq === 0 ? null : uniq,
          completion_pct: r.completion_pct == null ? null : Number(r.completion_pct),
          cta_clicks: (Number(r.cta_clicks) || 0) + (Number(r.call_clicks) || 0), leads: Number(r.leads) || 0,
          needs_follow_up: !!follow[r.project_id], unread_notifications: unread[r.project_id] || 0,
        };
      }
      return out;
    },
    async getPortfolio() {
      const client = await getClient();
      const { from, to } = periodRange('30d');
      const { data, error } = await client.rpc('owner_portfolio_summary', { p_from: from, p_to: to });
      if (error) throw error;
      return data;
    },
    async getUnread() { return unreadCount(await getClient()); },
    tabs: {
      audience: audienceTab(tabDeps),
      retarget: retargetTab(tabDeps),
      notifications: notificationsTab(tabDeps),
      analytics: (panel: HTMLElement, ctx: { openTab: (t: string, o?: unknown) => void; project: unknown }) => {
        let stop: (() => void) | null = null; let cancelled = false;
        getClient().then((client) => {
          if (cancelled) return;
          stop = mountAnalyticsTab(panel, ctx, {
            client,
            onPublish: () => (o.onPublish ? o.onPublish() : open(ctx.project as Row)),
            onOpenOpportunity: (id: string) => ctx.openTab('notifications', { focusId: id }),
            onCreateFollowup: () => ctx.openTab('retarget'),
          });
        }).catch((e: Error) => { panel.textContent = e.message; });
        return () => { cancelled = true; stop?.(); };
      },
    },
  };
}
