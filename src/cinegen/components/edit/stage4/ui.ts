// [remix] Stage 4: shared inline styles for the media-tools dock (kept inline like the Stage 1 bar: no stylesheet edits).
import type { CSSProperties } from 'react';
export const S: Record<string, CSSProperties> = {
  btn: { background: 'rgba(255,255,255,0.08)', color: 'inherit', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' },
  btnOn: { background: 'rgba(126,211,33,0.18)', color: '#bfe88a', border: '1px solid rgba(126,211,33,0.5)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' },
  input: { background: 'rgba(0,0,0,0.35)', color: 'inherit', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4, padding: '2px 6px', fontSize: 11, minWidth: 0 },
  row: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  h: { fontSize: 11, fontWeight: 600, marginTop: 10, opacity: 0.9 },
  small: { fontSize: 10.5, opacity: 0.7, lineHeight: 1.4 },
  err: { fontSize: 11, color: '#f87171', marginTop: 6 },
};
