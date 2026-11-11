// [remix] Browser for OpenChatCut's motion-graphics templates (assets/templates). Adds the chosen template to the overlay lane at the playhead.
import { useEffect, useMemo, useState } from 'react';
import { loadMgTemplates, type MgTemplate } from '@cinegen/lib/occ/mg-templates';

export function MgTemplatesModal({ onClose, onPick }: { onClose: () => void; onPick: (t: MgTemplate) => void }) {
  const [all, setAll] = useState<MgTemplate[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  useEffect(() => { void loadMgTemplates().then(setAll); }, []);
  const cats = useMemo(() => ['all', ...new Set((all ?? []).filter((t) => t.usable).map((t) => t.category))], [all]);
  // templates the code gate still rejects are not offered at all
  const list = (all ?? []).filter((t) => t.usable && (cat === 'all' || t.category === cat) && (!q || `${t.name} ${t.description ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const blocked = (all ?? []).filter((t) => !t.usable).length;
  return (
    <div role="dialog" aria-label="Motion graphics templates" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(760px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <strong style={{ flex: 1 }}>Motion graphics templates</strong>
          <button className="clip-properties-panel__toggle-btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="text" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, background: 'transparent', color: 'inherit', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, padding: '4px 8px' }} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ background: 'transparent', color: 'inherit', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6 }}>{cats.map((c) => <option key={c} value={c} style={{ color: '#000' }}>{c}</option>)}</select>
        </div>
        <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {!all && <span style={{ fontSize: 12, opacity: 0.7 }}>Loading…</span>}
          {list.map((t) => (
            <button key={t.id} disabled={!t.usable} title={t.usable ? t.description : `Blocked by the code gate: ${t.why}`} onClick={() => onPick(t)}
              style={{ textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.04)', color: 'inherit', cursor: t.usable ? 'pointer' : 'not-allowed', opacity: t.usable ? 1 : 0.4 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 10, opacity: 0.65 }}>{t.category} · {t.width}×{t.height} · {(t.durationInFrames / t.fps).toFixed(1)}s</div>
            </button>
          ))}
        </div>
        {all && <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>{all.length - blocked} templates available{blocked ? ` (${blocked} excluded: raw HTML injection is not allowed in the sandbox, or the repair could not be verified)` : ''}.</div>}
      </div>
    </div>
  );
}
