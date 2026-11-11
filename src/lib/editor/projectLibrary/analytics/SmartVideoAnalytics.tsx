/*
 * Supplied SmartVideo AI Analytics UI (smartvideo-analytics-ui.zip), integrated into the Projects
 * detail view. Markup, class names and SVG geometry are the supplied design. Adaptations for real data
 * are marked `ADAPT:`.
 */
import React, { useMemo, useState } from 'react';
import '../../../../../styles/smartvideo-analytics.css';

export type AnalyticsEvent = { day: string; plays: number };
export type AudiencePoint = { positionPercent: number; retentionPercent: number };
export type Section = { id: string; title: string; startMs: number; endMs: number; engagementPercent: number | null }; // ADAPT: null = no playback data for the period
export type Conversion = { label: string; clicks: number; uniqueSessions?: number };
export type Opportunity = { id: string; title: string; explanation: string; suggestion: string; icon: 'trend' | 'lead' | 'repeat'; unread?: boolean }; // ADAPT: unread marker
export type AnalyticsMetrics = { plays: number; uniqueViewers: number | null; completionRate: number | null; avgWatchSeconds: number | null; ctaClicks: number; leads: number };
export type ProjectAnalyticsData = {
  projectId: string; projectName: string; status: 'published' | 'draft' | 'unpublished';
  thumbnailUrl?: string; publishedUrl?: string; durationMs: number;
  metrics: AnalyticsMetrics; playsOverTime: AnalyticsEvent[]; retention: AudiencePoint[];
  sections: Section[]; conversions: Conversion[]; opportunities: Opportunity[];
};
export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'custom'; // ADAPT: Today + Custom range (date-filter requirement)
export type CustomRange = { from: string; to: string }; // YYYY-MM-DD (UTC days)
export type AnalyticsTab = 'overview' | 'engagement' | 'conversions';
export type SmartVideoAnalyticsProps = {
  project: ProjectAnalyticsData;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onCreateFollowup?: (projectId: string) => void;
  onSeekTo?: (timeMs: number) => void;
  onOpenOpportunity?: (opportunityId: string) => void;
  // ADAPT: custom date range, live preview slot (real player), user-facing footer note.
  customRange?: CustomRange;
  onCustomRangeChange?: (range: CustomRange) => void;
  renderPreview?: (project: ProjectAnalyticsData) => React.ReactNode;
  footerNote?: string;
  theme?: 'light' | 'dark'; // ADAPT: the editor is dark; the supplied default stays light
};
const n = (value: number) => new Intl.NumberFormat('en-US').format(value);
const pct = (value: number | null) => value === null ? '—' : `${Math.round(value)}%`;
const duration = (seconds: number | null) => {
  if (seconds === null) return '—';
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const symbols: Record<string, string> = {
  folder: '▱', play: '▷', users: '♙', check: '✓', clock: '◷', click: '↖', lead: '♧',
  insight: '✧', trend: '↗', repeat: '↻', link: '↗', filter: '☷', back: '‹'
};
function Icon({ name }: { name: string }) { return <span className="sv-icon" aria-hidden="true">{symbols[name] ?? '•'}</span>; }
function Stat({label, value, icon}: {label:string; value:string; icon:string}) {
  return <div className="sv-stat"><div className="sv-stat-label"><Icon name={icon}/>{label}</div><div className="sv-stat-value">{value}</div></div>;
}
function LineChart({values, labels, suffix = ''}: {values:number[];labels:string[];suffix?:string}) {
  const points = values.length ? values : [0];
  const high = Math.max(...points, 1);
  const coords = points.map((v,i)=>`${36+(i/(Math.max(1,points.length-1)))*622},${202-(v/high)*166}`).join(' ');
  return <div className="sv-chart-box"><svg viewBox="0 0 700 240" role="img" aria-label={`Line chart: ${values.map((v,i)=>`${labels[i] ?? i}: ${v}${suffix}`).join(', ')}`}>
    {[36,77.5,119,160.5,202].map(y=><line key={y} x1="36" x2="658" y1={y} y2={y} stroke="var(--sv-grid)" strokeDasharray="4 5"/>)}
    <polyline points={coords} fill="none" stroke="var(--sv-blue)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
    {points.map((v,i)=><circle key={i} cx={36+(i/Math.max(1,points.length-1))*622} cy={202-(v/high)*166} r="4" fill="var(--sv-blue)" stroke="var(--sv-panel)" strokeWidth="2"/>)}
    {labels.map((v,i)=>(i%Math.max(1,Math.ceil(labels.length/8))===0||i===labels.length-1)&&<text key={i} x={36+(i/Math.max(1,labels.length-1))*622} y="228" textAnchor="middle" fill="var(--sv-muted)" fontSize="12">{v}</text>)}{/* ADAPT: thin the x labels for 30/90-day ranges */}
  </svg></div>;
}
function RetentionChart({points}: {points: AudiencePoint[]}) {
  const sorted=[...points].sort((a,b)=>a.positionPercent-b.positionPercent);
  const coords=sorted.map(p=>`${36+(p.positionPercent/100)*622},${202-(p.retentionPercent/100)*166}`).join(' ');
  return <div className="sv-chart-box"><svg viewBox="0 0 700 240" role="img" aria-label={`Audience retention curve, ${sorted.length} data points`}>
    {[0,25,50,75,100].map(p=><g key={p}><line x1="36" x2="658" y1={202-p/100*166} y2={202-p/100*166} stroke="var(--sv-grid)" strokeDasharray="4 5"/><text x="28" y={206-p/100*166} textAnchor="end" fontSize="11" fill="var(--sv-muted)">{p}%</text></g>)}
    <polyline points={coords} fill="none" stroke="var(--sv-blue)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
    {[0,25,50,75,100].map(p=><text key={p} x={36+(p/100)*622} y="228" textAnchor="middle" fontSize="11" fill="var(--sv-muted)">{p}%</text>)}
  </svg></div>;
}
function Bars({items}:{items:Conversion[]}) {
  const max=Math.max(1,...items.map(i=>i.clicks));
  return <div className="sv-bars">{items.map((i)=><div className="sv-bar-row" key={i.label}><div className="sv-bar-label">{i.label}</div><div className="sv-bar-track"><div className="sv-bar-fill" style={{width:`${i.clicks/max*100}%`}}/></div><div className="sv-bar-number">{n(i.clicks)}</div></div>)}</div>;
}
export function EngagementExplorer({project,onSeekTo,renderPreview}:{project:ProjectAnalyticsData;onSeekTo?:(ms:number)=>void;renderPreview?:(project:ProjectAnalyticsData)=>React.ReactNode}) {
  const max=Math.max(1,project.durationMs);
  const buckets=Array.from({length:34},(_,i)=>{
    const pos=i/33*100;
    const nearest=project.retention.reduce((best,p)=>Math.abs(p.positionPercent-pos)<Math.abs(best.positionPercent-pos)?p:best, project.retention[0] ?? {positionPercent:0,retentionPercent:0});
    return nearest.retentionPercent;
  });
  const topSection=project.sections.slice().sort((a,b)=>b.engagementPercent-a.engagementPercent)[0];
  return <div className="sv-card sv-explorer">
    <h3>Video engagement explorer</h3><p className="sv-subtitle">Select a section to seek the existing project preview</p>
    {renderPreview ? <div className="sv-video-preview" data-testid="sv-live-preview">{renderPreview(project)}</div> : <div className="sv-video-preview">{project.thumbnailUrl ? <img src={project.thumbnailUrl} alt={`${project.projectName} video thumbnail`}/> : <div className="sv-video-placeholder">Video preview<br/><small>No thumbnail saved for this project yet</small></div>}<span className="sv-play-overlay" aria-hidden="true">▶</span></div>}
    <h4>Where viewers are paying attention</h4>
    <div className="sv-heatmap" role="img" aria-label="Relative retention across the video's runtime">
      {buckets.map((value,i)=><span key={i} className={topSection && (i/34)*max>=topSection.startMs && (i/34)*max<topSection.endMs?'sv-heat-highlight':''} style={{height:`${Math.max(7,value)}%`}}/>)}
    </div>
    <div className="sv-time-labels"><span>0:00</span><span>{duration(max/2000)}</span><span>{duration(max/1000)}</span></div>
    {project.sections.length===0&&<p className="sv-hint">No sections yet. Add two or more scenes to the timeline, or map interests in the Retarget tab, to explore engagement by section.</p>}
    <div className="sv-sections">{project.sections.map(s=><button key={s.id} type="button" className="sv-section" onClick={()=>onSeekTo?.(s.startMs)}><strong>{s.title}</strong><small>{duration(s.startMs/1000)}–{duration(s.endMs/1000)}</small></button>)}</div>
    <p className="sv-hint">The bars are derived from collected retention data. They are not individual viewer identities.</p>
  </div>;
}
export function MarketingOpportunities({items,onOpen}:{items:Opportunity[];onOpen?:(id:string)=>void}) {
 return <div className="sv-card"><div className="sv-panel-head"><h3>Marketing Opportunities</h3><span className="sv-pill">{items.length} alerts</span></div>
   {items.length===0?<p className="sv-subtitle">No opportunities detected for this period.</p>:items.map((i)=><button type="button" className="sv-opportunity" key={i.id} onClick={()=>onOpen?.(i.id)}><span className="sv-op-icon"><Icon name={i.icon}/>{i.unread&&<span className="sv-op-unread" role="img" aria-label="Unread"/>}</span><span className="sv-op-content"><strong>{i.title}</strong><span>{i.explanation}</span><b>{i.suggestion}</b></span><span className="sv-op-chevron">›</span></button>)}
 </div>;
}
export default function SmartVideoAnalytics({project,period,onPeriodChange,onCreateFollowup,onSeekTo,onOpenOpportunity,customRange,onCustomRangeChange,renderPreview,footerNote,theme='light'}:SmartVideoAnalyticsProps){
 const [tab,setTab]=useState<AnalyticsTab>('overview');
 const [copied,setCopied]=useState(false);
 const numbers=project.metrics;
 const labels=useMemo(()=>project.playsOverTime.map(p=>p.day),[project.playsOverTime]);
 async function copyUrl(){if (!project.publishedUrl) return;try {await navigator.clipboard.writeText(project.publishedUrl);setCopied(true);}catch {setCopied(false);}}
 return <main className={`sv-analytics${theme==='dark'?' sv-dark':''}`}>
  <div className="sv-heading"><div><div className="sv-breadcrumb"><Icon name="folder"/> Timeline Editor / Projects</div><h1>Video Analytics</h1></div><span className={`sv-status ${project.status==='published'?'sv-status-published':''}`}>{project.status==='published'?'✓ ':''}{project.status}</span></div>
  <div className="sv-toolbar"><div className="sv-project-name"><label>Selected project</label><div>{project.projectName}</div></div><div className="sv-toolbar-actions"><div className="sv-segment" aria-label="Reporting period">{(['today','7d','30d','90d','custom'] as const).map(p=><button key={p} aria-pressed={period===p} className={period===p?'active':''} onClick={()=>onPeriodChange(p)}>{p==='today'?'Today':p==='7d'?'7 days':p==='30d'?'30 days':p==='90d'?'90 days':'Custom'}</button>)}</div><button className="sv-secondary-btn" disabled={!project.publishedUrl} onClick={copyUrl}><Icon name="link"/>{copied?'Copied':'Copy video URL'}</button></div></div>
  {period==='custom'&&customRange&&<div className="sv-custom-range" role="group" aria-label="Custom date range"><label>From<input type="date" value={customRange.from} max={customRange.to} onChange={e=>onCustomRangeChange?.({...customRange,from:e.target.value})}/></label><label>To<input type="date" value={customRange.to} min={customRange.from} onChange={e=>onCustomRangeChange?.({...customRange,to:e.target.value})}/></label></div>}
  <nav className="sv-tabs" aria-label="Analytics views">{(['overview','engagement','conversions'] as const).map(t=><button key={t} aria-current={tab===t?'page':undefined} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</nav>
  {tab==='overview'&&<><section className="sv-stat-grid"><Stat icon="play" label="Video plays" value={n(numbers.plays)}/><Stat icon="users" label="Unique viewers" value={numbers.uniqueViewers===null?'—':n(numbers.uniqueViewers)}/><Stat icon="check" label="Completion rate" value={pct(numbers.completionRate)}/><Stat icon="clock" label="Avg. watch time" value={duration(numbers.avgWatchSeconds)}/><Stat icon="click" label="CTA clicks" value={n(numbers.ctaClicks)}/><Stat icon="lead" label="Leads captured" value={n(numbers.leads)}/></section><div className="sv-card"><div className="sv-panel-head"><h3>Video plays over time</h3><span className="sv-subtitle">Daily</span></div><LineChart labels={labels} values={project.playsOverTime.map(i=>i.plays)}/></div><div className="sv-insight"><div className="sv-insight-title"><Icon name="insight"/> Marketing insight</div><p>{project.opportunities[0]?.explanation ?? 'Insights will appear when your published video collects engagement data.'}</p><button type="button" className="sv-primary-btn" onClick={()=>onCreateFollowup?.(project.projectId)} disabled={!onCreateFollowup}>Plan personalized follow-up <span>→</span></button></div></>}
  {tab==='engagement'&&<><div className="sv-card"><h3>Audience retention</h3><p className="sv-subtitle">Percentage of playback sessions reaching each position in this video.</p>{project.retention.length===0?<p className="sv-subtitle sv-empty">No playback data for this period.</p>:<RetentionChart points={project.retention}/>}</div><EngagementExplorer project={project} onSeekTo={onSeekTo} renderPreview={renderPreview}/><div className="sv-card"><h3>Top engaged sections</h3>{project.sections.map(s=><div className="sv-section-bar" key={s.id}><div><span>{s.title}</span><strong>{pct(s.engagementPercent)}</strong></div><div className="sv-progress"><span style={{width:`${Math.max(0,Math.min(100,s.engagementPercent??0))}%`}}/></div></div>)}{project.sections.length===0&&<p className="sv-subtitle">No sections to show.</p>}</div></>}
  {tab==='conversions'&&<><div className="sv-card"><h3>Conversion activity</h3><p className="sv-subtitle">Interactions with the video’s published calls to action.</p>{project.conversions.length===0?<p className="sv-subtitle sv-empty">No call-to-action activity for this period.</p>:<Bars items={project.conversions}/>}</div><div className="sv-stat-grid"><Stat label="CTA clicks" value={n(numbers.ctaClicks)} icon="click"/><Stat label="Leads captured" value={n(numbers.leads)} icon="lead"/></div></>}
  <MarketingOpportunities items={project.opportunities} onOpen={onOpenOpportunity}/>
  <p className="sv-footer-note">{footerNote ?? 'Based on first-party tracking from your published video. Viewers are anonymous sessions, not identified people.'}</p>
 </main>;
}
