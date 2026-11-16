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
