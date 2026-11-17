import { useEffect, useId, useState, type ReactNode } from 'react';

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ');

export function Badge({ tone, children }: { tone?: 'good' | 'warn' | 'bad' | 'acc'; children: ReactNode }) { return <span className={cx('wb-badge', tone)}>{children}</span>; }
export function Btn({ pri, dng, sm, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pri?: boolean; dng?: boolean; sm?: boolean }) {
  return <button type="button" {...p} className={cx('wb-btn', pri && 'pri', dng && 'dng', sm && 'sm', p.className)} />;
}
export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return <section className="wb-card">{(title || actions) && <div className="wb-row" style={{ marginBottom: 10 }}>{title && <h3 style={{ margin: 0, flex: 1 }}>{title}</h3>}{actions}</div>}{children}</section>;
}
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="wb-card wb-stat"><span>{label}</span><b>{value}</b>{sub && <span>{sub}</span>}</div>;
}
export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId(); return <div className="wb-field"><label htmlFor={id}>{label}</label>{children(id)}</div>;
}
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="wb-modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="wb-modal" role="dialog" aria-label={title}>
    <h2>{title}</h2>{children}{footer && <div className="wb-row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>{footer}</div>}</div></div>;
}
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return <div className="wb-tabs" role="tablist">{tabs.map(t => <button key={t.id} role="tab" aria-selected={value === t.id} className={cx(value === t.id && 'on')} onClick={() => onChange(t.id)}>{t.label}</button>)}</div>;
}
export const Empty = ({ children }: { children: ReactNode }) => <div className="wb-empty">{children}</div>;
export const Bar = ({ value, tone }: { value: number; tone?: string }) => <div className="wb-bar"><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} /></div>;
export function useConfirm() {
  const [ask, setAsk] = useState<null | { msg: string; run: () => void }>(null);
  const el = ask && <Modal title="Are you sure?" onClose={() => setAsk(null)} footer={<><Btn onClick={() => setAsk(null)}>Cancel</Btn><Btn pri dng onClick={() => { ask.run(); setAsk(null); }}>Confirm</Btn></>}><p>{ask.msg}</p></Modal>;
  return { confirm: (msg: string, run: () => void) => setAsk({ msg, run }), el };
}

/** Inline SVG line/area chart. */
export function LineChart({ data, height = 90, color = 'var(--acc)' }: { data: { date: string; value: number }[]; height?: number; color?: string }) {
  const w = 300, max = Math.max(1, ...data.map(d => d.value));
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * w},${height - 6 - (d.value / max) * (height - 14)}`);
  return <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" aria-label="trend chart" preserveAspectRatio="none">
    <polyline points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} opacity=".15" />
    <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return <div>{steps.map(s => <div key={s.label} style={{ marginBottom: 8 }}><div className="wb-row wb-sm"><span>{s.label}</span><span className="wb-sp" /><b>{s.value}</b></div><Bar value={(s.value / max) * 100} /></div>)}</div>;
}

const ICONS: Record<string, string> = {
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4', clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2', branch: 'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9', check: 'M20 6L9 17l-5-5',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8zM7 7h.01', briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.7 21a2 2 0 01-3.4 0', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  undo: 'M3 7v6h6M3 13a9 9 0 0115-6.7L21 9', redo: 'M21 7v6h-6M21 13a9 9 0 00-15-6.7L3 9', history: 'M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2', play: 'M5 3l14 9-14 9z',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z', trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6', archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4', star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z', reply: 'M9 17l-5-5 5-5M20 18v-2a4 4 0 00-4-4H4', forward: 'M15 17l5-5-5-5M4 18v-2a4 4 0 014-4h12', x: 'M18 6L6 18M6 6l12 12', search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z', draft: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5', spam: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z', snooze: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l3 3',
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5 5h14l3 7v7a1 1 0 01-1 1H3a1 1 0 01-1-1v-7z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8', kanban: 'M4 4h5v16H4zM15 4h5v10h-5z',
  mail: 'M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zM22 6l-10 7L2 6', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9z', plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4', gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
};
export function Icon({ name }: { name: keyof typeof ICONS | string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[name] ?? ICONS.home} /></svg>;
}
export const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
export const fmtDateTime = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
export const money = (n: number) => `$${n.toLocaleString()}`;
export function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
