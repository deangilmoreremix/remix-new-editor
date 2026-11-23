// [remix] Read-only preview of the Analytics tab for a video that is not published yet. Sample figures only.
import { SAMPLE_ANALYTICS } from '@cinegen/lib/leads/sample-data';

const VIEWS = ['Analytics', 'Audience', 'Retarget', 'Alerts'];

export function SampleAnalytics() {
  const pts = SAMPLE_ANALYTICS.retention;
  const w = 600; const h = 120;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => h - (v / 100) * h;
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div className="cg-sample" data-testid="analytics-sample" aria-hidden="true" inert>
      <div className="cg-sample__head"><span className="cg-sample__badge">Sample data</span><span>What you will see once your video is published and viewed</span></div>
      <div className="cg-sample__tabs">{VIEWS.map((v, i) => <span key={v} className={`cg-analytics__tab${i === 0 ? ' is-active' : ''}`}>{v}</span>)}</div>
      <div className="cg-sample__cards">
        {SAMPLE_ANALYTICS.cards.map(([label, value]) => (
          <div key={label} className="cg-sample__card"><div className="cg-sample__label">{label}</div><div className="cg-sample__value">{value}</div></div>
        ))}
      </div>
      <div className="cg-sample__chart">
        <div className="cg-sample__label">Audience retention: share of viewers still watching</div>
        <div className="cg-sample__plot">
          <div className="cg-sample__yaxis">{[100, 75, 50, 25, 0].map((t) => <span key={t}>{t}%</span>)}</div>
          <div className="cg-sample__area">
            {[0, 25, 50, 75, 100].map((t) => <i key={t} className="cg-sample__grid" style={{ bottom: `${t}%` }} />)}
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Sample retention curve">
              <path d={`${line} L${w},${h} L0,${h} Z`} fill="rgba(34,211,238,.15)" />
              <path d={line} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="cg-sample__end" style={{ bottom: `${pts[pts.length - 1]}%` }}>{pts[pts.length - 1]}% finish</span>
          </div>
        </div>
        <div className="cg-sample__axis"><span>0:00</span><span>25%</span><span>50%</span><span>75%</span><span>End of video</span></div>
      </div>
    </div>
  );
}
