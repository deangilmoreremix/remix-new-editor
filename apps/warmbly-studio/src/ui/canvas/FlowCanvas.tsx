import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, cx } from '../kit';
import { layoutCanvas, type CNode } from './layout';

export interface AddOption { kind: string; label: string; icon: string }
export interface FlowCanvasProps {
  root: CNode;
  selectedId?: string | null;
  /** Node ids on the path to highlight (automation test). Others are dimmed. */
  hotIds?: Set<string> | null;
  hotEdges?: Set<string> | null;
  onSelect?: (id: string | null) => void;
  addOptions?: (parentId: string, slot: string) => AddOption[];
  onAdd?: (parentId: string, slot: string, kind: string) => void;
  readOnly?: boolean;
  footer?: ReactNode;
}

const MIN = 0.3, MAX = 1.6;
export function FlowCanvas({ root, selectedId, hotIds, hotEdges, onSelect, addOptions, onAdd, readOnly, footer }: FlowCanvasProps) {
  const layout = useMemo(() => layoutCanvas(root), [root]);
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 24, k: 1 });
  const [menu, setMenu] = useState<{ id: string; parentId: string; slot: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const fitted = useRef(false);

  const fit = useCallback(() => {
    const el = ref.current; if (!el) return;
    const w = el.clientWidth || 800, h = el.clientHeight || 520, b = layout.bounds;
    const k = Math.max(MIN, Math.min(1, Math.min(w / b.w, h / b.h)));
    setView({ k, x: w / 2 - (b.x + b.w / 2) * k, y: 24 - b.y * k - SIZE_PAD * k });
  }, [layout.bounds]);
  // Open at 100%, centred on the root, top-aligned (like upstream); the Fit button fits everything.
  const home = useCallback(() => {
    const el = ref.current; if (!el) return;
    setView({ k: 1, x: (el.clientWidth || 800) / 2, y: 28 });
  }, []);
  useEffect(() => { if (!fitted.current) { fitted.current = true; home(); } }, [home]);

  const zoom = (f: number, cx0?: number, cy0?: number) => setView(v => {
    const el = ref.current; const k = Math.max(MIN, Math.min(MAX, v.k * f));
    const px = cx0 ?? (el?.clientWidth ?? 0) / 2, py = cy0 ?? (el?.clientHeight ?? 0) / 2;
    return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
  });
  // Native listener: React's onWheel is passive, so preventDefault (needed to stop page zoom on pinch) would be ignored.
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { const r = el.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top); }
      else setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', h, { passive: false }); return () => el.removeEventListener('wheel', h);
  }, []);
  const onDown = (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('.wb-cn,.wb-pl,.wb-menu,.wb-cv-tools')) return; setMenu(null); onSelect?.(null); setDrag({ sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }); };
  useEffect(() => {
    if (!drag) return;
    const mv = (e: MouseEvent) => setView(v => ({ ...v, x: drag.vx + e.clientX - drag.sx, y: drag.vy + e.clientY - drag.sy }));
    const up = () => setDrag(null);
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [drag]);

  const dimmed = (id: string) => !!hotIds && !hotIds.has(id);
  const opts = menu && addOptions ? addOptions(menu.parentId, menu.slot) : [];
  return <div ref={ref} className={cx('wb-cv', drag && 'drag')} onMouseDown={onDown} data-testid="flow-canvas">
    <div className="wb-cv-world" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})` }}>
      <svg className="edges" width="1" height="1">
        {layout.edges.map(e => <path key={e.id} d={e.d} className={cx('e', e.dashed && 'dash', hotEdges?.has(e.id) && 'hot')} />)}
      </svg>
      {layout.edges.filter(e => e.label).map(e => <span key={e.id + 'l'} className={cx('wb-lab', e.label!.text.toLowerCase())} style={{ left: e.label!.x, top: e.label!.y }}>{e.label!.text}</span>)}
      {layout.nodes.map(n => <button key={n.id} type="button" data-node-id={n.id} aria-label={`${n.node.title}`} aria-pressed={selectedId === n.id}
        className={cx('wb-cn', n.node.kind === 'delay' && 'pill', selectedId === n.id && 'sel', hotIds?.has(n.id) && 'hot', dimmed(n.id) && 'dim')}
        style={{ left: n.x, top: n.y, width: n.w, height: n.h }} onClick={e => { e.stopPropagation(); onSelect?.(n.id); }}>
        {n.node.kind === 'delay' ? <><Icon name="clock" /><span>{n.node.title}</span></> : <>
          <span className={cx('ic', n.node.tone)}><Icon name={n.node.icon} /></span>
          <div><div className="t">{n.node.title}</div>{n.node.subtitle && <div className="s">{n.node.subtitle}</div>}</div></>}
      </button>)}
      {!readOnly && addOptions && layout.plus.map(p => <button key={p.id} type="button" aria-label="Add step" className={cx('wb-pl', p.atEdge && 'edge', menu?.id === p.id && 'open')} style={{ left: p.x, top: p.y }}
        onClick={e => { e.stopPropagation(); setMenu(m => (m?.id === p.id ? null : { id: p.id, parentId: p.parentId, slot: p.slot, x: p.x + 18, y: p.y })); }}><Icon name="plus" /></button>)}
      {menu && opts.length > 0 && <div className="wb-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
        {opts.map(o => <button key={o.kind} role="menuitem" onClick={e => { e.stopPropagation(); onAdd?.(menu.parentId, menu.slot, o.kind); setMenu(null); }}><span className="ic"><Icon name={o.icon} /></span>{o.label}</button>)}</div>}
    </div>
    <div className="wb-cv-tools" role="toolbar" aria-label="Canvas controls">
      <button aria-label="Zoom out" onClick={() => zoom(0.85)}><Icon name="minus" /></button><span aria-label="Zoom level">{Math.round(view.k * 100)}%</span>
      <button aria-label="Zoom in" onClick={() => zoom(1.15)}><Icon name="plus" /></button><button aria-label="Fit to screen" onClick={fit}><Icon name="expand" /></button>
    </div>
    {footer}
  </div>;
}
const SIZE_PAD = 40;
