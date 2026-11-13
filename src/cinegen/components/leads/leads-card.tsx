// [remix] Right column of the Leads tab: KPIs, filter chips, search, CSV, table, delete.
import { useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { answerColumns, countsByForm, filterRows, leadForms, rowFormKey, rowsToCsv, whenLabel, LEAD_RANGES, type LeadRange, type LeadRow } from '@cinegen/lib/leads/leads';
import { setLeadsForm, useLeadsForm } from '@cinegen/lib/leads/leads-filter';
import type { LeadsData } from './use-leads';

export function LeadsCard({ data, published, views }: { data: LeadsData; published: boolean; views: number }) {
  const { state } = useWorkspace();
  const form = useLeadsForm();
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<LeadRange>('all');
  const forms = leadForms(state.overlays ?? []);
  const counts = countsByForm(data.rows);
  const shown = filterRows(data.rows, { form, query, range });
  const cols = answerColumns(shown);
  const total = data.rows.length;
  const wall = counts['list-builder'] ?? 0;
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
        <div><b>{total - wall}</b><span>Lead Generator</span></div><div><b>{pct}</b><span>Of viewers signed up</span></div>
      </div>
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
            <button type="button" className="leads-btn" onClick={() => void data.reload()} disabled={data.loading}>{data.loading ? 'Loading…' : 'Refresh'}</button>
            <button type="button" className="leads-btn" onClick={download} disabled={!shown.length} data-testid="leads-csv">Download CSV</button>
          </div>
          {data.error && <p className="leads-error" role="alert">{data.error}</p>}
          {!data.error && !data.loading && shown.length === 0 && <p className="leads-note" data-testid="leads-empty">{total ? 'No leads match.' : 'No leads yet. They appear here when viewers fill out a form on your published link.'}</p>}
          {shown.length > 0 && (
            <div className="leads-tablewrap"><table className="leads-table" data-testid="leads-table">
              <thead><tr><th>When</th><th>Form</th>{cols.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={r.id}><td>{whenLabel(r.createdAt)}</td><td><span className={`leads-tag leads-tag--${tag(r)?.tone ?? 'lead'}`}>{tag(r)?.short ?? 'Form'}</span></td>
                  {cols.map((c) => <td key={c.key}>{r.data[c.key] ?? ''}</td>)}
                  <td><button type="button" className="leads-x" aria-label="Delete lead" onClick={() => { if (window.confirm('Delete this lead?')) void data.remove(r.id); }}>✕</button></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}
    </section>
  );
}
