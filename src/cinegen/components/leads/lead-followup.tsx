// [remix] The follow-up controls of one lead row: a coloured status dropdown, tag chips and a note popover.
import { useState } from 'react';
import { LEAD_STATUSES, addTag, removeTag, type LeadRow } from '@cinegen/lib/leads/leads';

export type FollowUpPatch = { status?: string; notes?: string; tags?: string[] | string };

export function StatusSelect({ status, onChange }: { status: string; onChange: (next: string) => void }) {
  return (
    <select className={`leads-status leads-status--${status}`} aria-label="Status" value={status} onChange={(e) => onChange(e.target.value)} data-testid="lead-status">
      {LEAD_STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
  );
}

export function TagChips({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const next = draft.split(',').reduce((all, t) => addTag(all, t), tags); // a pasted "a, b" adds both
    setDraft('');
    if (next.length !== tags.length) onChange(next);
  };
  return (
    <div className="leads-tags" data-testid="lead-tags">
      {tags.map((t) => (
        <span key={t} className="leads-tagchip">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(removeTag(tags, t))}>×</button></span>
      ))}
      {tags.length < 10 && (
        <input
          className="leads-taginput" placeholder={tags.length ? '+' : '+ tag'} aria-label="Add tag" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
            else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={commit}
        />
      )}
    </div>
  );
}

export function NoteButton({ notes, onSave }: { notes: string; onSave: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes);
  const toggle = () => { setDraft(notes); setOpen((o) => !o); };
  const save = () => { if (draft !== notes) onSave(draft); setOpen(false); };
  return (
    <span className="leads-note-wrap">
      <button type="button" className={`leads-notebtn${notes ? ' has-note' : ''}`} aria-expanded={open} aria-label="Note" title={notes || 'Add a note'} onClick={toggle} data-testid="lead-note-btn">{notes ? 'Note ●' : 'Note'}</button>
      {open && (
        <div className="leads-notepop" role="dialog" aria-label="Lead note" data-testid="lead-note-pop">
          <textarea value={draft} maxLength={2000} rows={4} autoFocus aria-label="Note text" placeholder="Private note (only you see this)" onChange={(e) => setDraft(e.target.value)} />
          <div className="leads-notepop__bar"><span>{draft.length}/2000</span><button type="button" className="leads-btn" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="leads-btn leads-btn--primary" onClick={save} data-testid="lead-note-save">Save</button></div>
        </div>
      )}
    </span>
  );
}

export function FollowUpCell({ row, onUpdate }: { row: LeadRow; onUpdate: (patch: FollowUpPatch) => void }) {
  return (
    <td className="leads-followup" data-testid="lead-followup">
      <StatusSelect status={row.status ?? 'new'} onChange={(status) => onUpdate({ status })} />
      <TagChips tags={row.tags ?? []} onChange={(tags) => onUpdate({ tags })} />
      <NoteButton notes={row.notes ?? ''} onSave={(notes) => onUpdate({ notes })} />
    </td>
  );
}
