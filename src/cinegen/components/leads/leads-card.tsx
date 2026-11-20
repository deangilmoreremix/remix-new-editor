// [remix] Right column of the Leads tab: KPIs, filter chips, search, CSV / Excel, table, score, follow-up, delete.
import { useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { LEAD_STATUSES, hasFollowUp, answerColumns, collapseRepeats, countsByForm, leadsPerDay, filterRows, fromMp4, variantCounts, variantOf, leadForms, rowFormKey, rowsToCsv, exportRecords, scoreLead, sortRows, statusCounts, sourceLabel, whenLabel, LEAD_RANGES, type LeadRange, type LeadForm, type LeadRow, type LeadSort, sessionOf, watchPercent, watchTag } from '@cinegen/lib/leads/leads';
import { downloadLeadsXlsx } from '@cinegen/lib/leads/leads-xlsx';
import { setLeadsForm, useLeadsForm } from '@cinegen/lib/leads/leads-filter';
import { FollowUpCell } from './lead-followup';
import { SAMPLE_FORMS, SAMPLE_LEADS, SAMPLE_VIEWS } from '@cinegen/lib/leads/sample-data';
import { formStatLine } from '@cinegen/lib/leads/form-stats';
import type { LeadsData } from './use-leads';
import type { Insights } from './use-insights';

const NEXT_SORT: Record<LeadSort, LeadSort> = { newest: 'score-desc', 'score-desc': 'score-asc', 'score-asc': 'newest' };
const SORT_ARIA: Record<LeadSort, 'none' | 'ascending' | 'descending'> = { newest: 'none', 'score-desc': 'descending', 'score-asc': 'ascending' };

function ScorePill({ row }: { row: LeadRow }) {
  const s = scoreLead(row);
  return <span className={`leads-score leads-score--${s.label.toLowerCase()}`} data-testid="lead-score" title={s.reasons.join(' · ') || 'No signals yet'}>{s.score} · {s.label}</span>;
}

function LeadsCardView({ data, published, views, formsOverride, insights }: { data: LeadsData; published: boolean; views: number; formsOverride?: LeadForm[]; insights?: Insights }) {
  const { state } = useWorkspace();
  const form = useLeadsForm();
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<LeadRange>('all');
  const forms = formsOverride ?? leadForms(state.overlays ?? []);
  const counts = countsByForm(data.rows);
  const [merge, setMerge] = useState(false);
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<LeadSort>('newest');
  const [xlsxError, setXlsxError] = useState('');
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const followUp = hasFollowUp(data.rows);
  const inScope = filterRows(data.rows, { form, query, range }); // the status chips count within this
  const byStatus = statusCounts(inScope);
  const filtered = followUp && status !== 'all' ? inScope.filter((r) => (r.status ?? 'new') === status) : inScope;
  const repeats = collapseRepeats(filtered);
  const hasRepeats = repeats.rows.length < filtered.length;
  const shown = sortRows(merge ? repeats.rows : filtered, sort);
  const perDay = leadsPerDay(data.rows);
  const peak = Math.max(1, ...perDay.map((d) => d.n));
  const cols = answerColumns(shown);
  const showSource = shown.some((r) => sourceLabel(r)); // the column appears once any lead has a source
  const total = data.rows.length;
  const wall = counts['list-builder'] ?? 0;
  const mp4 = data.rows.filter(fromMp4).length;
  const ab = variantCounts(data.rows);
  const watch = insights?.watch ?? {};
  const showWatch = shown.some((r) => watch[sessionOf(r)]);
  const pct = views > 0 ? `${Math.min(100, Math.round((total / views) * 100))}%` : '—';
  const tag = (r: LeadRow) => forms.find((f) => f.key === rowFormKey(r));
  const download = () => {
    const url = URL.createObjectURL(new Blob([rowsToCsv(shown, forms, watch)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const downloadExcel = async () => {
    setXlsxBusy(true); setXlsxError('');
    try { await downloadLeadsXlsx(exportRecords(shown, forms, { escape: false, watch })); }
    catch (e) { setXlsxError((e as Error).message || 'Could not create the Excel file'); }
    setXlsxBusy(false);
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
          {insights?.formStats && forms.length > 0 && (
            <div className="leads-perf" data-testid="form-performance">
              {forms.map((f) => <div key={f.key} className="leads-perf__row"><b>{f.label}</b><span data-testid={`perf-${f.key}`}>{formStatLine(insights.formStats?.byKey[f.key], insights.formStats?.minCohort)}</span></div>)}
              <p className="leads-note">Views are counted when at least half of a form is on screen (last 90 days, shown once enough viewers have seen it).</p>
            </div>
          )}
          {followUp && (
            <div className="leads-chips" role="group" aria-label="Filter by status" data-testid="leads-status-filter">
              <button type="button" className={`leads-chip${status === 'all' ? ' is-on' : ''}`} aria-pressed={status === 'all'} onClick={() => setStatus('all')} data-testid="status-chip-all">Any status {inScope.length}</button>
              {LEAD_STATUSES.map(([id, label]) => (
                <button key={id} type="button" className={`leads-chip leads-chip--${id}${status === id ? ' is-on' : ''}`} aria-pressed={status === id} onClick={() => setStatus(status === id ? 'all' : id)} data-testid={`status-chip-${id}`}>{label} {byStatus[id] ?? 0}</button>
              ))}
            </div>
          )}
          <div className="leads-row">
            <input className="leads-input" placeholder="Search leads…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="leads-search" />
            <select className="leads-input leads-select" aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value as LeadRange)} data-testid="leads-range">
              {LEAD_RANGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <button type="button" className="leads-btn" onClick={() => { void data.reload(); void insights?.reload?.(); }} disabled={data.loading}>{data.loading ? 'Loading…' : 'Refresh'}</button>
            <button type="button" className="leads-btn" onClick={download} disabled={!shown.length} data-testid="leads-csv">Download CSV</button>
            <button type="button" className="leads-btn" onClick={() => void downloadExcel()} disabled={!shown.length || xlsxBusy} data-testid="leads-xlsx">{xlsxBusy ? 'Preparing…' : 'Download Excel'}</button>
          </div>
          {hasRepeats && (
            <label className="leads-note leads-merge"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} data-testid="leads-merge" /> Merge repeat sign-ups (same email on the same form) — {filtered.length - repeats.rows.length} repeat{filtered.length - repeats.rows.length === 1 ? '' : 's'} hidden when on</label>
          )}
          {data.error && <p className="leads-error" role="alert">{data.error}</p>}
          {xlsxError && <p className="leads-error" role="alert" data-testid="leads-xlsx-error">{xlsxError}</p>}
          {!data.error && !data.loading && shown.length === 0 && <p className="leads-note" data-testid="leads-empty">{total ? 'No leads match.' : 'No leads yet. They appear here when viewers fill out a form on your published link.'}</p>}
          {shown.length > 0 && (
            <div className="leads-tablewrap"><table className="leads-table" data-testid="leads-table">
              <thead><tr>
                <th>When</th><th>Form</th>
                <th aria-sort={SORT_ARIA[sort]}><button type="button" className="leads-sort" onClick={() => setSort(NEXT_SORT[sort])} data-testid="leads-sort-score" title="Sort by lead score">Score{sort === 'score-desc' ? ' ↓' : sort === 'score-asc' ? ' ↑' : ''}</button></th>
                {cols.map((c) => <th key={c.key}>{c.label}</th>)}{showSource && <th>Source</th>}{showWatch && <th>Watched</th>}{followUp && <th>Follow-up</th>}<th />
              </tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={r.id}><td>{whenLabel(r.createdAt)}{merge && (repeats.counts[r.id] ?? 1) > 1 && <span className="leads-tag leads-tag--rep" data-testid="repeat-tag" title="Times this email signed up on this form">×{repeats.counts[r.id]}</span>}</td><td><span className={`leads-tag leads-tag--${tag(r)?.tone ?? 'lead'}`}>{tag(r)?.short ?? 'Form'}</span>{fromMp4(r) && <span className="leads-tag leads-tag--mp4" data-testid="mp4-tag">MP4</span>}{variantOf(r) && <span className="leads-tag leads-tag--ab" data-testid="ab-tag">{variantOf(r)}</span>}</td>
                  <td><ScorePill row={r} /></td>
                  {cols.map((c) => <td key={c.key}>{r.data[c.key] ?? ''}</td>)}
                  {showSource && <td data-testid="lead-source" title={r.source?.referrer ?? ''}>{sourceLabel(r)}</td>}
                  {showWatch && (
                    <td data-testid="lead-watched">{watch[sessionOf(r)] ? <><span>{watchPercent(watch[sessionOf(r)])}</span><span className={`leads-tag leads-tag--${watchTag(watch[sessionOf(r)]).toLowerCase()}`}>{watchTag(watch[sessionOf(r)])}</span></> : ''}</td>
                  )}
                  {followUp && <FollowUpCell row={r} onUpdate={(patch) => void data.update(r.id, patch)} />}
                  <td><button type="button" className="leads-x" aria-label="Delete lead" onClick={() => { if (window.confirm('Delete this lead?')) void data.remove(r.id); }}>✕</button></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}
    </section>
  );
}

const NOOP_DATA: LeadsData = { rows: SAMPLE_LEADS, loading: false, error: '', reload: async () => {}, remove: async () => {}, update: async () => {} } as LeadsData;

/** Before publishing there is nothing to show, so the tab previews its layout with labelled, read-only sample rows. */
export function LeadsCard({ data, published, views, insights }: { data: LeadsData; published: boolean; views: number; insights?: Insights }) {
  if (published) return <LeadsCardView data={data} published views={views} insights={insights} />;
  return (
    <section className="leads-card" data-testid="leads-card">
      <h3 className="leads-card__title">Leads<span className="leads-sample-badge" data-testid="leads-sample-badge">Sample data</span></h3>
      <p className="leads-note" data-testid="leads-unpublished">Publish this video to start collecting leads. This is a preview of what you will see here.</p>
      <div className="leads-preview" aria-hidden="true" inert>
        <LeadsCardView data={NOOP_DATA} published views={SAMPLE_VIEWS} formsOverride={SAMPLE_FORMS} />
      </div>
    </section>
  );
}
