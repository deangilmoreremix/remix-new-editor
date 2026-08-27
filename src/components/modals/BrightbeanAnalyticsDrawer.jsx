import React, { useState, useEffect, useCallback } from 'react';
import brightbean from '../../lib/brightbean';

const APP_ACCENT = '#6d5efc';

function Sparkline({ data, width = 200, height = 40, color = APP_ACCENT }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`).join(' L ');
  return (<svg width={width} height={height} style={{ display: 'block' }}><path d={`M ${points}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}

function KpiCard({ label, value, kind }) {
  const formattedValue = kind === 'percent' ? `${Number(value).toFixed(1)}%` : kind === 'minutes' ? `${Math.round(Number(value))} min` : Number(value).toLocaleString();
  return (
    <div style={{ flex: 1, minWidth: 80, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#fff' }}>{formattedValue}</div>
    </div>
  );
}

const BrightbeanAnalyticsDrawer = ({ options = {}, handleClose }) => {
  const { postId } = options;
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!postId) { setError('No post ID provided.'); return; }
    setLoading(true);
    setError(null);
    try { setAnalytics(await brightbean.getPostAnalytics(postId)); }
    catch (e) { setError(e.message || 'Could not load analytics.'); }
    finally { setLoading(false); }
  }, [postId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const allMetrics = analytics?.platform_posts?.flatMap(pp => (pp.metric_tiles || []).map(t => ({ ...t, platform: pp.platform }))) || [];

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(180deg, rgba(11,13,22,0.95), rgba(11,13,22,0.98))', borderTop: '1px solid rgba(109,94,252,0.3)', borderRadius: '20px 20px 0 0', padding: '20px 24px 32px', zIndex: 10001, maxHeight: '60vh', overflow: 'auto', backdropFilter: 'blur(12px)' }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 16px' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6d5efc,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📊</div>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Post Analytics</div></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={fetchAnalytics} disabled={loading} style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↻ Refresh</button>
          <button type="button" onClick={handleClose} style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕</button>
        </div>
      </div>
      {loading && <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.5)' }}><span style={{ display: 'inline-block', width: 20, height: 20, marginRight: 8, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />Loading…</div>}
      {error && !loading && <div style={{ background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 8, padding: '12px 16px', color: '#ff9a9a', fontSize: 13 }}>{error}</div>}
      {!loading && !error && analytics && (
        <>
          {allMetrics.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {allMetrics.slice(0, 6).map(m => <KpiCard key={`${m.platform}-${m.key}`} label={m.label} value={m.value} kind={m.kind} />)}
              </div>
              {allMetrics.filter(m => m.series?.length > 1).slice(0, 4).map(m => (
                <div key={`spark-${m.platform}-${m.key}`} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 80 }}>{m.label}</span>
                  <Sparkline data={m.series} width={160} height={32} />
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.5)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <div>No analytics data yet</div>
            </div>
          )}
        </>
      )}
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
};

export default BrightbeanAnalyticsDrawer;
