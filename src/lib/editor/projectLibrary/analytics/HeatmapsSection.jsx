/**
 * "Heatmaps" section of the Analytics tab (Stage 7). Mounted from SmartVideoAnalytics.tsx via its `renderHeatmaps`
 * slot. Four views (click / CTA / video engagement / scroll depth), date range, video, CTA and device filters,
 * intensity slider, overlay toggle, CSV export and a printable report. All data: owner-only aggregated RPCs; sets
 * smaller than the minimum cohort are shown as "not enough data" (nothing is drawn or exported for them).
 * There is NO pointer-movement heatmap by design (privacy: it approximates reading behaviour per person, and is not
 * eye tracking). There is no campaign filter: campaign data does not exist on this branch.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../../../../styles/heatmaps.css';
import { periodRange, defaultCustomRange } from './analyticsData.js';
import { HeatmapCanvas, EngagementStrip } from './heatmap/HeatmapCanvas.jsx';
import {
  HEATMAP_TYPES, VIEWPORTS, loadHeatmap, cellsToPoints, pageAspect, topPageBucket, ctaRows, engagementSeries, scrollRows,
  heatmapCsv, csvFilename, downloadCsv,
} from './heatmap/heatmapData.js';

const PRESETS = [['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['custom', 'Custom range']];
const pctText = (v) => (v == null ? '—' : `${Math.round(v * 1000) / 10}%`);
const typeLabel = (t) => HEATMAP_TYPES.find(([k]) => k === t)?.[1] || t;

export default function HeatmapsSection({ client, video, projectName, thumbnailUrl, now, doc = globalThis.document }) {
  const [type, setType] = useState('click');
  const [preset, setPreset] = useState('30d');
  const [custom, setCustom] = useState(() => defaultCustomRange(now));
  const [videoId, setVideoId] = useState(video?.id);
  const [videos, setVideos] = useState(video ? [{ id: video.id, title: video.title || projectName || video.id }] : []);
  const [viewport, setViewport] = useState('all');
  const [cta, setCta] = useState('all');
  const [intensity, setIntensity] = useState(1);
  const [overlay, setOverlay] = useState(true);
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = useRef(0);
  const range = useMemo(() => periodRange(preset, custom, now), [preset, custom, now]);

  // Video selection: the owner's other published videos (RLS limits this to the caller's own).
  useEffect(() => {
    let live = true;
    Promise.resolve(client?.from?.('published_videos')?.select?.('id, title').order?.('updated_at', { ascending: false })?.limit?.(50))
      .then((r) => {
        const rows = Array.isArray(r?.data) ? r.data : [];
        if (!live || !rows.length) return;
        setVideos((cur) => {
          const m = new Map(cur.map((v) => [v.id, v]));
          rows.forEach((x) => { if (x?.id) m.set(x.id, { id: x.id, title: x.title || x.id }); });
          return [...m.values()];
        });
      }).catch(() => { /* the current video stays selectable */ });
    return () => { live = false; };
  }, [client]);

  const load = useCallback(() => {
    if (!videoId) return;
    const mine = ++token.current;
    setLoading(true); setError(null);
    loadHeatmap(client, { videoId, type, from: range.from, to: range.to, viewport, cta })
      .then((r) => { if (mine === token.current) { setLoaded(r); setLoading(false); } })
      .catch((e) => { if (mine === token.current) { setError(e.message || 'Could not load heatmap data'); setLoading(false); } });
  }, [client, videoId, type, range.from, range.to, viewport, cta]);
  useEffect(() => { load(); return () => { token.current += 1; }; }, [load]);
  // A CTA that no longer exists for the new video/filters must not stay selected.
  useEffect(() => { setCta('all'); }, [videoId]);

  const ctas = useMemo(() => ctaRows(loaded?.ctas), [loaded]);
  const d = loaded?.data;
  const points = useMemo(() => (type === 'click' && d && !d.suppressed ? cellsToPoints(d.cells, d.grid) : []), [type, d]);
  const series = useMemo(() => (type === 'engagement' ? engagementSeries(d) : null), [type, d]);
  const scroll = useMemo(() => (type === 'scroll' ? scrollRows(d) : []), [type, d]);
  const bucket = topPageBucket(d?.page_buckets);
  const suppressed = !!(d && d.suppressed) && type !== 'cta';
  const currentTitle = videos.find((v) => v.id === videoId)?.title || projectName || videoId;
  const exportable = !!loaded && !loading && !error && (type === 'cta' ? ctas.length > 0 : !!d && !suppressed);

  const exportCsv = () => { if (exportable) downloadCsv(heatmapCsv(type, loaded), csvFilename(type, videoId, range.from, range.to), doc); };
  const print = () => globalThis.print?.();

  return (
    <section className="sv-heatmaps" aria-label="Heatmaps" data-testid="heatmaps-section">
      <div className="sv-card sv-heat-controls">
        <div className="sv-panel-head"><h3>Heatmaps</h3><span className="sv-subtitle">Aggregated from published-page viewers. Small samples are hidden.</span></div>
        <div className="sv-heat-types" role="tablist" aria-label="Heatmap type">
          {HEATMAP_TYPES.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={type === k} className={type === k ? 'active' : ''} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
        <div className="sv-heat-filters">
          <label>Video
            <select value={videoId || ''} onChange={(e) => setVideoId(e.target.value)} aria-label="Video">
              {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select></label>
          <label>Date range
            <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Date range">
              {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          {preset === 'custom' && (
            <>
              <label>From<input type="date" aria-label="From date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
              <label>To<input type="date" aria-label="To date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
            </>
          )}
          <label>Device
            <select value={viewport} onChange={(e) => setViewport(e.target.value)} aria-label="Device">
              {VIEWPORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label>CTA
            <select value={cta} onChange={(e) => setCta(e.target.value)} aria-label="CTA" disabled={type !== 'click'} title={type === 'click' ? '' : 'The CTA filter applies to the click heatmap'}>
              <option value="all">All clicks</option>
              {ctas.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.kindLabel})</option>)}
            </select></label>
          <label>Intensity
            <input type="range" min="0.3" max="2" step="0.1" value={intensity} aria-label="Intensity" onChange={(e) => setIntensity(Number(e.target.value))} /></label>
          <label className="sv-heat-check"><input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} aria-label="Overlay" /> Overlay</label>
        </div>
        <div className="sv-heat-actions">
          <button type="button" className="sv-secondary-btn" onClick={exportCsv} disabled={!exportable}>Export CSV</button>
          <button type="button" className="sv-secondary-btn" onClick={print}>Print report</button>
        </div>
      </div>

      <div className="sv-card sv-heat-report" aria-busy={loading}>
        <header className="sv-heat-report-head">
          <h3>{typeLabel(type)}</h3>
          <p className="sv-subtitle" data-testid="heat-summary">
            {currentTitle} · {range.from} to {range.to} · {VIEWPORTS.find(([k]) => k === viewport)?.[1]}
            {type === 'click' && cta !== 'all' ? ` · CTA: ${ctas.find((c) => c.key === cta)?.label || cta}` : ''}
          </p>
        </header>
        {error && <p role="alert" className="sv-subtitle">{error} <button type="button" className="sv-secondary-btn" onClick={load}>Try again</button></p>}
        {!error && loading && !loaded && <p className="sv-subtitle" role="status">Loading…</p>}
        {!error && loaded && suppressed && (
          <p className="sv-subtitle sv-empty" role="status" data-testid="heat-suppressed">
            Not enough data yet: at least {d.min_cohort} viewing sessions are needed before this is shown ({d.sessions} so far for these filters). This protects individual viewers.
          </p>
        )}
        {!error && loaded && type === 'click' && d && !d.suppressed && (
          <>
            <HeatmapCanvas points={points} aspect={pageAspect(bucket, viewport === 'all' ? 'desktop' : viewport)} intensity={intensity} visible={overlay}
              label={`Click heatmap from ${d.clicks} clicks in ${d.sessions} sessions`}>
              {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="sv-heat-backdrop" /> : <div className="sv-heat-wire" aria-hidden="true"><span>Video</span></div>}
            </HeatmapCanvas>
            <p className="sv-subtitle">{d.clicks} clicks from {d.sessions} sessions. Position is relative to the watch page; the backdrop is a schematic of a page about {bucket * 400}px tall, not a screenshot of each visit.</p>
          </>
        )}
        {!error && loaded && type === 'cta' && (
          ctas.length === 0 ? <p className="sv-subtitle sv-empty">No call-to-action activity for these filters.</p> : (
            <table className="sv-heat-table">
              <thead><tr><th>CTA</th><th>Type</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead>
              <tbody>{ctas.map((c) => (
                <tr key={c.key}><td>{c.label}</td><td>{c.kindLabel}</td>
                  <td>{c.suppressed ? 'not enough data' : c.impressions ?? '—'}</td><td>{c.suppressed ? '—' : c.clicks ?? '—'}</td><td>{pctText(c.ctr)}</td></tr>))}
              </tbody>
            </table>
          )
        )}
        {!error && loaded && type === 'cta' && <p className="sv-subtitle">Impression = the CTA was at least 50% visible once in a session. CTR = sessions that used the CTA / sessions that saw it; "—" where no impressions were recorded (older views).</p>}
        {!error && loaded && type === 'engagement' && series && (
          <>
            <EngagementStrip series={series} intensity={intensity} visible={overlay} />
            <div className="sv-time-labels"><span>0:00</span><span>{Math.round(series.seconds / 2)}s</span><span>{series.seconds}s</span></div>
            <ul className="sv-heat-facts">
              <li>{d.sessions} sessions with playback</li>
              <li>Peak drop-off: {series.peakDropoffSecond == null ? '—' : `second ${series.peakDropoffSecond}`} (red marker)</li>
              <li>Replayed seconds: {series.totalReplays} · Skipped seconds: {series.totalSkips}</li>
            </ul>
            <p className="sv-subtitle">Colour = viewers per second; white bars = replays.</p>
          </>
        )}
        {!error && loaded && type === 'scroll' && !suppressed && (
          <>
            <div className="sv-bars" data-testid="scroll-bars">
              {scroll.map((r) => (
                <div className="sv-bar-row" key={r.milestone}><div className="sv-bar-label">{r.milestone}% of page</div>
                  <div className="sv-bar-track"><div className="sv-bar-fill" style={{ width: `${r.percent ?? 0}%` }} /></div>
                  <div className="sv-bar-number">{r.percent == null ? '—' : `${r.percent}%`}</div></div>))}
            </div>
            <p className="sv-subtitle">{d?.sessions} sessions. CTA exposure: {d?.sessions ? pctText(d.cta_exposed_sessions / d.sessions) : '—'} of sessions saw at least one CTA. A page that fits the screen counts as 100% reached.</p>
          </>
        )}
      </div>
    </section>
  );
}
