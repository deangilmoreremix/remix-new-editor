/**
 * Image field for the page editor: a link box plus "Choose from my library", which lists images
 * made in any studio (generation history). Only https images are offered; the page still runs the
 * value through its own safe-image check when it renders.
 */
import { useState } from 'react';

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--lp-field-border, #cbd5e1)', borderRadius: 6, background: 'var(--lp-field-bg, #fff)', color: 'var(--lp-field-text, inherit)', font: 'inherit' };
const btnStyle = { marginTop: 6, padding: '6px 10px', border: '1px solid var(--lp-field-border, #cbd5e1)', borderRadius: 6, background: 'var(--lp-field-bg-alt, #f8fafc)', color: 'var(--lp-field-text, inherit)', cursor: 'pointer', font: 'inherit', fontSize: 12 };

export const isHttpsImage = (e) => e && e.type !== 'video' && e.type !== 'audio' && typeof e.url === 'string' && /^https:\/\//i.test(e.url);
export const isHttpsVideo = (e) => e && e.type === 'video' && typeof e.url === 'string' && /^https:\/\//i.test(e.url);

function Library({ onPick, onClose, kind = 'image' }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  if (items === null && !err) {
    import('../../generationHistory.js')
      .then((m) => m.loadGenerationHistory())
      .then((all) => setItems((all || []).filter(kind === 'video' ? isHttpsVideo : isHttpsImage).slice(0, 60)))
      .catch(() => setErr('Could not load your library.'));
  }
  return (
    <div style={{ marginTop: 8, padding: 8, border: '1px solid var(--lp-field-border, #e2e8f0)', borderRadius: 8, background: 'var(--lp-field-bg, #fff)' }}>
      {err ? <p style={{ fontSize: 12, color: '#f87171' }}>{err}</p> : null}
      {items && !items.length ? <p style={{ fontSize: 12 }}>No {kind === 'video' ? 'videos' : 'images'} in your library yet. Make one in any studio and it will appear here.</p> : null}
      {items === null && !err ? <p style={{ fontSize: 12 }}>Loading…</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {(items || []).map((e) => (
          <button key={e.url} type="button" onClick={() => onPick(e.url)} title={e.prompt || ''} style={{ padding: 0, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: '#f1f5f9' }}>
            {kind === 'video' && !e.thumbnail_url
              ? <video src={`${e.url}#t=0.5`} muted preload="metadata" style={{ display: 'block', width: '100%', height: 64, objectFit: 'cover', background: '#000' }} />
              : <img src={e.thumbnail_url || e.url} alt={e.prompt || `Library ${kind}`} loading="lazy" style={{ display: 'block', width: '100%', height: 64, objectFit: 'cover' }} />}
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose} style={btnStyle}>Close</button>
    </div>
  );
}

export function imageField(label, kind = 'image') {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, name }) => {
      const [open, setOpen] = useState(false); // eslint-disable-line react-hooks/rules-of-hooks
      return (
        <div>
          <label style={labelStyle} htmlFor={name}>{label}</label>
          <input id={name} style={inputStyle} value={value || ''} placeholder={kind === 'video' ? 'https://…/video.mp4 or choose from your library' : 'https://… or choose from your library'} onChange={(e) => onChange(e.target.value)} />
          <button type="button" style={btnStyle} onClick={() => setOpen((o) => !o)}>{open ? 'Hide library' : kind === 'video' ? 'Choose a video I made' : 'Choose from my library'}</button>
          {open ? <Library kind={kind} onPick={(u) => { onChange(u); setOpen(false); }} onClose={() => setOpen(false)} /> : null}
        </div>
      );
    },
  };
}

/** Swap every text field that asks for an image link for the library-aware field. */
export function withImagePickers(components) {
  const isVid = (f) => f && f.type === 'text' && /video you made/i.test(f.label || '');
  const isImg = (f) => f && f.type === 'text' && /image|photo|picture|logo|avatar/i.test(f.label || '') && !/#hex|colou?r/i.test(f.label || '');
  for (const comp of Object.values(components)) {
    const fields = comp.fields || {};
    for (const [k, f] of Object.entries(fields)) {
      if (isVid(f)) fields[k] = imageField(f.label, 'video');
      else if (isImg(f)) fields[k] = imageField(f.label);
      else if (f?.type === 'array' && f.arrayFields) {
        for (const [ak, af] of Object.entries(f.arrayFields)) if (isImg(af)) f.arrayFields[ak] = imageField(af.label);
      }
    }
  }
  return components;
}
