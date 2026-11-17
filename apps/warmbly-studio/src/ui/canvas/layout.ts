export type CTone = 'acc' | 'warn' | 'good' | 'purple' | 'mute';
export interface CNode {
  id: string; kind: 'start' | 'step' | 'delay' | 'condition';
  icon: string; title: string; subtitle?: string; tone?: CTone;
  /** Outgoing slots. Linear nodes have one ('next'); conditions have 'yes' and 'no'. */
  slots: { slot: string; label?: string; node: CNode | null }[];
}
export interface LNode { id: string; x: number; y: number; w: number; h: number; node: CNode }
export interface LEdge { id: string; d: string; dashed?: boolean; label?: { x: number; y: number; text: string }; from: string; to: string }
export interface LPlus { id: string; x: number; y: number; parentId: string; slot: string; atEdge: boolean }
export interface Layout { nodes: LNode[]; edges: LEdge[]; plus: LPlus[]; bounds: { x: number; y: number; w: number; h: number } }

export const SIZE = { node: { w: 260, h: 64 }, delay: { w: 132, h: 30 }, gap: 60, hgap: 40, placeholder: 150, pad: 40 };
const sizeOf = (n: CNode) => (n.kind === 'delay' ? SIZE.delay : SIZE.node);

const subW = new WeakMap<CNode, number>();
function subtreeWidth(n: CNode): number {
  const cached = subW.get(n); if (cached !== undefined) return cached;
  const own = sizeOf(n).w;
  const ws = n.slots.map(s => (s.node ? subtreeWidth(s.node) : SIZE.placeholder));
  const w = n.slots.length > 1 ? Math.max(own, ws.reduce((a, b) => a + b, 0) + SIZE.hgap * (ws.length - 1)) : Math.max(own, ws[0] ?? 0);
  subW.set(n, w); return w;
}
function elbow(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(x1 - x2) < 0.5) return `M ${x1} ${y1} V ${y2}`;
  const ym = y1 + 12, r = Math.min(14, Math.abs(x2 - x1) / 2, (y2 - y1) / 4), dir = x2 > x1 ? 1 : -1;
  return `M ${x1} ${y1} V ${ym - r} Q ${x1} ${ym} ${x1 + dir * r} ${ym} H ${x2 - dir * r} Q ${x2} ${ym} ${x2} ${ym + r} V ${y2}`;
}

/** Tidy top-down tree layout. Origin is the top-left of the root's bounding box; x is centred on 0. */
export function layoutCanvas(root: CNode): Layout {
  const nodes: LNode[] = [], edges: LEdge[] = [], plus: LPlus[] = [];
  const place = (n: CNode, cx: number, y: number) => {
    const { w, h } = sizeOf(n); nodes.push({ id: n.id, x: cx - w / 2, y, w, h, node: n });
    const ny = y + h + SIZE.gap;
    const widths = n.slots.map(s => (s.node ? subtreeWidth(s.node) : SIZE.placeholder));
    const total = widths.reduce((a, b) => a + b, 0) + SIZE.hgap * (widths.length - 1);
    let left = cx - total / 2;
    n.slots.forEach((s, i) => {
      const ccx = n.slots.length > 1 ? left + widths[i] / 2 : cx; left += widths[i] + SIZE.hgap;
      const eid = `${n.id}:${s.slot}`;
      const label = s.label ? { x: ccx, y: ny - 22, text: s.label } : undefined;
      if (s.node) {
        edges.push({ id: eid, d: elbow(cx, y + h, ccx, ny), from: n.id, to: s.node.id, label });
        plus.push({ id: `${eid}+`, x: label ? ccx + 40 : ccx, y: label ? ny - 22 : ny - SIZE.gap / 2, parentId: n.id, slot: s.slot, atEdge: true });
        place(s.node, ccx, ny);
      } else {
        edges.push({ id: eid, d: elbow(cx, y + h, ccx, ny + 8), dashed: true, from: n.id, to: '', label });
        plus.push({ id: `${eid}+`, x: ccx, y: ny + 8, parentId: n.id, slot: s.slot, atEdge: false });
      }
    });
  };
  place(root, 0, 0);
  const xs = [...nodes.flatMap(n => [n.x, n.x + n.w]), ...plus.map(p => p.x - 14), ...plus.map(p => p.x + 14)];
  const x = Math.min(...xs) - SIZE.pad, maxX = Math.max(...xs) + SIZE.pad;
  const maxY = Math.max(...nodes.map(n => n.y + n.h), ...plus.map(p => p.y + 14)) + SIZE.pad;
  return { nodes, edges, plus, bounds: { x, y: -SIZE.pad, w: maxX - x, h: maxY + SIZE.pad } };
}
