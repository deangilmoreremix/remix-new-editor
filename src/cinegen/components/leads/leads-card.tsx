// [remix] Right column of the Leads tab: KPIs, filter chips, search, CSV, table, delete.
import { useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { LEAD_STATUSES, hasFollowUp, answerColumns, collapseRepeats, countsByForm, leadsPerDay, filterRows, fromMp4, variantCounts, variantOf, leadForms, rowFormKey, rowsToCsv, sourceLabel, whenLabel, LEAD_RANGES, type LeadRange, type LeadRow } from '@cinegen/lib/leads/leads';
import { setLeadsForm, useLeadsForm } from '@cinegen/lib/leads/leads-filter';
import type { LeadsData } from './use-leads';

export function LeadsCard({ data, published, views }: { data: LeadsData; published: boolean; views: number }) {
  const { state } = useWorkspace();
  const form = useLeadsForm();
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<LeadRange>('all');
  const forms = leadForms(state.overlays ?? []);
  const counts = countsByForm(data.rows);
  const [merge, setMerge] = useState(false);
  const [status, setStatus] = useState('all');
  const followUp = hasFollowUp(data.rows);
  const filtered = filterRows(data.rows, { form, query, range, status: followUp ? status : 'all' });
  const repeats = collapseRepeats(filtered);
  const hasRepeats = repeats.rows.length < filtered.length;
  const shown = merge ? repeats.rows : filtered;
  const perDay = leadsPerDay(data.rows);
  const peak = Math.max(1, ...perDay.map((d) => d.n));
  const cols = answerColumns(shown);
  const showSource = shown.some((r) => sourceLabel(r)); // the column appears once any lead has a source
  const total = data.rows.length;
  const wall = counts['list-builder'] ?? 0;
  const mp4 = data.rows.filter(fromMp4).length;
  const ab = variantCounts(data.rows);
  const pct = views > 0 ? `${Math.min(100, Math.round((total / views) * 100))}%` : '—';
  const tag = (r: LeadRow) => forms.find((f) => f.key === rowFormKey(r));
  const download = () => {
    const url = URL.createObjectURL(new Blob([rowsToCsv(shown, forms)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <section className="leads-card" data-testid="leads-card">
      <h3 className="leads-card__title">Leads</h3>
      <div className="leads-kpis">
        <div><b>{total}</b><span>Total</span></div><div><b>{wall}</b><span>List Builder</span></div>
        <div><b>{total - wall}</b><span>Lead Generator</span></div><div><b>{pct}</b><span>Of viewers signed up</span></div><div data-testid="kpi-mp4"><b>{mp4}</b><span>From MP4 link</span></div>
      </div>
      {ab && <p className="leads-note" data-testid="ab-counts">A/B test: version A <b>{ab.A}</b> leads · version B <b>{ab.B}</b> leads (viewers are split about evenly).</p>}
      {total > 0 && (
        <div className="leads-chart" data-testid="leads-chart" role="img" aria-label={`Leads per day, last ${perDay.length} days`}>
          <div className="leads-chart__bars">
            {perDay.map((d) => <div key={d.day} className="leads-chart__col" title={`${d.label}: ${d.n} ${d.n === 1 ? 'lead' : 'leads'}`}><span className="leads-chart__bar" style={{ height: `${Math.round((d.n / peak) * 100)}%` }} data-n={d.n} /></div>)}
          </div>
          <div className="leads-chart__axis"><span>{perDay[0].label}</span><span>Leads per day</span><span>{perDay[perDay.length - 1].label}</span></div>
        </div>
      )}
      {!published ? <p className="leads-note" data-testid="leads-unpublished">Publish this video to start collecting leads.</p> : (
        <>
          <div className="leads-chips">
            <button type="button" className={`leads-chip${form === 'all' ? ' is-on' : ''}`} onClick={() => setLeadsForm('all')}>All {total}</button>
            {forms.map((f) => <button key={f.key} type="button" className={`leads-chip${form === f.key ? ' is-on' : ''}`} onClick={() => setLeadsForm(f.key)}>{f.label} {counts[f.key] ?? 0}</button>)}
          </div>
          <div className="leads-row">
            <input className="leads-input" placeholder="Search leads…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="leads-search" />
            <select className="leads-input leads-select" aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value as LeadRange)} data-testid="leads-range">
              {LEAD_RANGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            {followUp && (
              <select className="leads-input leads-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="leads-status-filter">
                <option value="all">Any status</option>
                {LEAD_STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            )}
            <button type="button" className="leads-btn" onClick={() => void data.reload()} disabled={data.loading}>{data.loading ? 'Loading…' : 'Refresh'}</button>
            <button type="button" className="leads-btn" onClick={download} disabled={!shown.length} data-testid="leads-csv">Download CSV</button>
          </div>
          {hasRepeats && (
            <label className="leads-note leads-merge"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} data-testid="leads-merge" /> Merge repeat sign-ups (same email on the same form) — {filtered.length - repeats.rows.length} repeat{filtered.length - repeats.rows.length === 1 ? '' : 's'} hidden when on</label>
          )}
          {data.error && <p className="leads-error" role="alert">{data.error}</p>}
          {!data.error && !data.loading && shown.length === 0 && <p className="leads-note" data-testid="leads-empty">{total ? 'No leads match.' : 'No leads yet. They appear here when viewers fill out a form on your published link.'}</p>}
          {shown.length > 0 && (
            <div className="leads-tablewrap"><table className="leads-table" data-testid="leads-table">
              <thead><tr><th>When</th><th>Form</th>{cols.map((c) => <th key={c.key}>{c.label}</th>)}{showSource && <th>Source</th>}{followUp && <th>Follow-up</th>}<th /></tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={r.id}><td>{whenLabel(r.createdAt)}{merge && (repeats.counts[r.id] ?? 1) > 1 && <span className="leads-tag leads-tag--rep" data-testid="repeat-tag" title="Times this email signed up on this form">×{repeats.counts[r.id]}</span>}</td><td><span className={`leads-tag leads-tag--${tag(r)?.tone ?? 'lead'}`}>{tag(r)?.short ?? 'Form'}</span>{fromMp4(r) && <span className="leads-tag leads-tag--mp4" data-testid="mp4-tag">MP4</span>}{variantOf(r) && <span className="leads-tag leads-tag--ab" data-testid="ab-tag">{variantOf(r)}</span>}</td>
                  {cols.map((c) => <td key={c.key}>{r.data[c.key] ?? ''}</td>)}
                  {followUp && (
                    <td className="leads-followup" data-testid="lead-followup">
                      <select aria-label="Status" value={r.status ?? 'new'} onChange={(e) => void data.update(r.id, { status: e.target.value })}>
                        {LEAD_STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                      <input key={`n-${r.id}-${r.notes ?? ''}`} placeholder="Note" defaultValue={r.notes ?? ''} maxLength={2000} aria-label="Note" onBlur={(e) => { if (e.target.value !== (r.notes ?? '')) void data.update(r.id, { notes: e.target.value }); }} />
                      <input key={`t-${r.id}-${(r.tags ?? []).join(',')}`} placeholder="tags, comma separated" defaultValue={(r.tags ?? []).join(', ')} aria-label="Tags" onBlur={(e) => { const next = e.target.value; if (next !== (r.tags ?? []).join(', ')) void data.update(r.id, { tags: next }); }} />
                    </td>
                  )}
                  {showSource && <td data-testid="lead-source" title={r.source?.referrer ?? ''}>{sourceLabel(r)}</td>}
                  <td><button type="button" className="leads-x" aria-label="Delete lead" onClick={() => { if (window.confirm('Delete this lead?')) void data.remove(r.id); }}>✕</button></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}
    </section>
  );
}
