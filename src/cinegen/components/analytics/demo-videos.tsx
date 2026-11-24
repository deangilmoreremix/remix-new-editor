// [remix] DEMO videos for the Analytics and Heatmaps tabs: three made-up videos with made-up viewers, so a person with nothing
// published yet can open the real Analytics screen (and its Heatmaps) and click through it. The numbers come from
// lib/editor/projectLibrary/analytics/demo (a stand-in data client used ONLY here); real analytics never read them.
// "Remove demo videos" hides them (this browser only); "Show demo videos" brings them back.
import { useEffect, useRef, useState } from 'react';
// @ts-expect-error plain JS
import { DEMO_VIDEOS, getDemoVideo } from '../../../lib/editor/projectLibrary/analytics/demo/demoVideos.js';
// @ts-expect-error plain JS
import { createDemoClient } from '../../../lib/editor/projectLibrary/analytics/demo/demoClient.js';
// @ts-expect-error plain JS
import { demosHidden, setDemosHidden, DEMOS_CHANGED_EVENT } from '../../../lib/editor/projectLibrary/analytics/demo/demoPrefs.js';
// @ts-expect-error plain JS
import { mountAnalyticsTab } from '../../../lib/editor/projectLibrary/analytics/mountAnalyticsTab.jsx';

type Demo = { id: string; title: string; tagline: string; story: string; lookFor: string[]; thumbnailUrl: string };

/** [hidden, setHidden]: shared by every place that shows the demos, and kept in step across tabs of the page. */
export function useDemosHidden(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState<boolean>(() => demosHidden());
  useEffect(() => {
    const sync = () => setHidden(demosHidden());
    window.addEventListener(DEMOS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DEMOS_CHANGED_EVENT, sync);
  }, []);
  return [hidden, (h: boolean) => setDemosHidden(h)];
}

/** The real Analytics screen (with its Heatmaps section) running on one demo video. */
function DemoAnalytics({ demo }: { demo: Demo }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    setNote('');
    const stop = mountAnalyticsTab(
      host,
      { project: { id: demo.id, name: demo.title, videoId: demo.id, thumbnail_url: demo.thumbnailUrl } },
      {
        client: createDemoClient(),
        onOpenOpportunity: () => setNote('Alerts open here for your own videos. The demo alerts are for reading only.'),
      },
    );
    return () => { try { stop?.(); } catch { /* already unmounted */ } };
  }, [demo]);
  return (
    <>
      {note && <p className="cg-analytics__toast" role="status">{note}</p>}
      <div ref={hostRef} className="cg-analytics__host" data-testid="demo-analytics-host" />
    </>
  );
}

/**
 * The demo strip (three cards, a remove button) and, when one is open, the demo's Analytics screen below it.
 * `openId` / `onOpen` are owned by the tab so that it can hide its own content while a demo is open.
 */
export function DemoVideos({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const [, setHidden] = useDemosHidden();
  const open: Demo | null = openId ? getDemoVideo(openId) : null;
  const remove = () => { onOpen(null); setHidden(true); };
  return (
    <>
    <section className="cg-demos" data-testid="demo-videos" aria-label="Demo videos">
      <div className="cg-demos__head">
        <div>
          <h3 className="cg-demos__title">Demo videos <span className="cg-sample__badge">Sample data</span></h3>
          <p className="cg-demos__sub">See how Analytics and Heatmaps look once viewers have watched a video. These three videos and their viewers are made up.</p>
        </div>
        <button type="button" className="mini-btn" data-testid="demo-remove" onClick={remove}>Remove demo videos</button>
      </div>
      <div className="cg-demos__grid">
        {(DEMO_VIDEOS as Demo[]).map((d) => (
          <button key={d.id} type="button" className="cg-demo-card" aria-pressed={openId === d.id} data-testid={`demo-card-${d.id}`}
            onClick={() => onOpen(openId === d.id ? null : d.id)}>
            <img src={d.thumbnailUrl} alt="" loading="lazy" />
            <span className="cg-demo-card__text">
              <strong>{d.title}</strong>
              <span>{d.tagline}</span>
              <em>{openId === d.id ? 'Close' : 'Open'}</em>
            </span>
          </button>
        ))}
      </div>
      {open && (
        <div className="cg-demos__open" data-testid="demo-open">
          <div className="cg-demos__banner" role="note">
            <strong>Demo: {open.title}.</strong> {open.story} Nothing here is real, and your own videos are never mixed into it.
            <ul>{open.lookFor.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      )}
    </section>
    {open && <DemoAnalytics demo={open} />}
    </>
  );
}

/** What stays where the demos were once they are removed: one quiet line that brings them back. */
export function DemoRestore() {
  const [, setHidden] = useDemosHidden();
  return (
    <p className="cg-demos-removed" data-testid="demo-restore">
      Demo videos removed. <button type="button" className="cg-demos-removed__btn" onClick={() => setHidden(false)}>Show demo videos</button>
    </p>
  );
}

