// [remix] Share / Publish: the old editor's share panel (src/lib/editor/publish/sharePanel.js) and publish client, fed from the CineGen
// timeline + overlays. A published video is the interactive snapshot played at /watch/<id> (the MP4 export cannot carry forms/CTAs).
import { useEffect, useMemo, useRef } from 'react';
import type { Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS
import { renderSharePanel } from '../../../lib/editor/publish/sharePanel.js';
// @ts-expect-error plain JS
import * as pub from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import { supabase, uploadFileToStorage } from '../../../lib/hybrid-supabase.js';
import '../../../../styles/personalize-ui.css';

export { buildPublishState } from '@cinegen/lib/leads/publish-state';
import { buildPublishState } from '@cinegen/lib/leads/publish-state';

const KEY = 'remix.cinegen.published.v1';
const readIds = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

export function SharePanel({ timeline, assets, overlays, projectKey }: { timeline: Timeline; assets: Asset[]; overlays: OverlayClip[]; projectKey: string }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ timeline, assets, overlays });
  latest.current = { timeline, assets, overlays };
  const key = useMemo(() => `${projectKey}:${timeline.id}`, [projectKey, timeline.id]);
  useEffect(() => {
    if (!host.current) return;
    const client = async () => {
      const w = window as unknown as { Clerk?: { user?: unknown } };
      if (!w.Clerk?.user) throw new Error('Sign in to publish videos');
      await supabase.refreshUserHeader?.();
      if (!supabase.supabase) throw new Error('The video service is unavailable — check your connection');
      return supabase.supabase;
    };
    const videoId = () => readIds()[key] || null;
    host.current.innerHTML = '';
    renderSharePanel(host.current, {
      defaultTitle: timeline.name || 'Untitled video',
      async getInfo() { const id = videoId(); if (!id || !(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user) return null; return pub.getMyVideo(await client(), id); },
      async publish({ title }: { title: string }) {
        const c = await client();
        const { timeline: tl, assets: as, overlays: ov } = latest.current;
        const state = buildPublishState(tl, as, ov, title);
        await pub.uploadLocalMedia(state, { getBlob: () => null, upload: uploadFileToStorage });
        const project = pub.preparePublishProject(state, { title });
        const id = videoId() || pub.makeSlug();
        const info = await pub.publishVideo(c, { id, project });
        localStorage.setItem(KEY, JSON.stringify({ ...readIds(), [key]: id }));
        return { ...info, published: true };
      },
      async setPublished(on: boolean) { await pub.setPublished(await client(), videoId(), on); },
      copy: (text: string) => navigator.clipboard.writeText(text),
      fetchStats: async () => pub.fetchVideoStats(await client(), videoId()),
    });
  }, [key, timeline.name]);
  return <div ref={host} className="pz-ui" data-testid="share-panel" style={{ marginTop: 12 }} />;
}
