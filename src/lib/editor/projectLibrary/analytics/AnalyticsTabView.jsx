/**
 * Analytics tab of the Projects detail view. Wraps the supplied
 * SmartVideoAnalytics component with real data, the existing player and the
 * existing notification / personalization flows.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SmartVideoAnalytics from './SmartVideoAnalytics';
import LivePreview from './LivePreview.jsx';
import { loadAnalytics, defaultCustomRange } from './analyticsData.js';

const Skeleton = () => (
  <div className="sv-analytics sv-editor" aria-busy="true" aria-label="Loading analytics">
    <div className="prj-skel"><i /><i /><i /></div>
  </div>
);

export default function AnalyticsTabView({ client, projectRow, createPlayer, now, onOpenOpportunity, onCreateFollowup, onPublish, initialPeriod = '7d' }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [custom, setCustom] = useState(() => defaultCustomRange(now));
  const [result, setResult] = useState(null);   // { status, data, video, hasTracking, range }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const preview = useRef(null);
  const token = useRef(0);

  const load = useCallback(() => {
    const mine = ++token.current;
    setLoading(true); setError(null);
    loadAnalytics(client, { projectRow, period, custom, now })
      .then((r) => { if (mine === token.current) { setResult(r); setLoading(false); } })
      .catch((e) => { if (mine === token.current) { setError(e.message || 'Could not load analytics'); setLoading(false); } });
  }, [client, projectRow, period, custom, now]);

  useEffect(() => { load(); return () => { token.current += 1; }; }, [load]);

  const renderPreview = useCallback((p) => (
    <LivePreview ref={preview} project={p} snapshot={result?.video?.project} thumbnailUrl={p.thumbnailUrl} createPlayer={createPlayer} />
  ), [result, createPlayer]);

  const handlers = useMemo(() => ({
    onSeekTo: (ms) => preview.current?.seekTo(ms),
    onOpenOpportunity: (id) => onOpenOpportunity?.(id),
    onCreateFollowup: onCreateFollowup ? () => onCreateFollowup() : undefined,
  }), [onOpenOpportunity, onCreateFollowup]);

  if (error) {
    return (
      <div className="sv-analytics sv-editor"><div className="sv-card" role="alert">
        <h3>Analytics could not be loaded</h3>
        <p className="sv-subtitle">{error}</p>
        <button type="button" className="sv-primary-btn" onClick={load}>Try again</button>
      </div></div>
    );
  }
  if (loading && !result) return <Skeleton />;
  if (result?.status === 'unpublished') {
    return (
      <div className="sv-analytics sv-editor"><div className="sv-card">
        <h3>Publish this video to see analytics</h3>
        <p className="sv-subtitle">Analytics come from viewers of the hosted video page, where clicks, calls and forms can be measured. An exported MP4 file cannot report them. Your editable project is kept when you publish.</p>
        {onPublish && <button type="button" className="sv-primary-btn" onClick={onPublish}>Publish video <span>→</span></button>}
      </div></div>
    );
  }
  if (!result?.data) return <Skeleton />;
  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
      {!result.hasTracking && (
        <div className="sv-analytics sv-editor" style={{ paddingBottom: 0 }}><p className="sv-hint" role="status">No viewing data has been collected for this period yet. Share the published link to start collecting it; zeros below are real, and "—" means not enough data to calculate.</p></div>
      )}
      <SmartVideoAnalytics
        project={result.data}
        period={period}
        onPeriodChange={setPeriod}
        customRange={custom}
        onCustomRangeChange={setCustom}
        renderPreview={renderPreview}
        theme="editor"
        {...handlers}
      />
    </div>
  );
}
