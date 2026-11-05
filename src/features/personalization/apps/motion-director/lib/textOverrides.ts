/**
 * Rewrite the words a recipe draws. A recipe is a demo with its text written in its source,
 * so the clip carries `texts` (original string -> replacement) and, after every render, the
 * words in the rendered tree are swapped. Pure function of the map and the tree: the
 * preview, the thumbnails and the export agree.
 */
export type TextMap = Record<string, string>;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** The clip prop may arrive as an object or as JSON text (the Inspector and the agent write objects). */
export function parseTextMap(raw: unknown): TextMap {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: TextMap = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string' && val.trim() && norm(k) && norm(val) !== norm(k)) out[k] = val;
  }
  return out;
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** Per-letter recipes draw each character in its own element: spread the replacement over them. */
function isLetterRow(el: Element): boolean {
  const kids = Array.from(el.children);
  return kids.length >= 2 && kids.length === el.childNodes.length && kids.every((k) => k.children.length === 0 && (k.textContent ?? '').length === 1);
}

export function applyTextOverrides(root: Element, texts: TextMap): void {
  const entries = Object.entries(texts).map(([from, to]) => ({ key: norm(from), to }));
  if (!entries.length) return;
  const exact = new Map(entries.map((e) => [e.key, e.to]));

  // 1. A row of single-letter elements whose letters spell a key.
  const rows: Element[] = [];
  const collect = (el: Element) => {
    if (isLetterRow(el)) rows.push(el);
    else for (const child of Array.from(el.children)) collect(child);
  };
  collect(root);
  for (const row of rows) {
    const to = exact.get(norm(row.textContent ?? ''));
    if (to === undefined) continue;
    const kids = Array.from(row.children);
    const chars = Array.from(to);
    kids.forEach((k, i) => {
      k.textContent = i === kids.length - 1 ? chars.slice(i).join('') : (chars[i] ?? '');
    });
  }

  // 2. A phrase drawn in pieces (a word per element, a line break in between): hand the new words
  //    out over the pieces in order, so each keeps its own animation.
  const squash = (v: string) => v.replace(/\s+/g, '').toLowerCase();
  const pieces = new Map(entries.map((e) => [squash(e.key), e.to]));
  const textNodesOf = (el: Element): Node[] => {
    const found: Node[] = [];
    const w = el.ownerDocument.createTreeWalker(el, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) if ((n.nodeValue ?? '').trim()) found.push(n);
    return found;
  };
  const spread = (el: Element) => {
    if (isLetterRow(el)) return;
    const to = pieces.get(squash(el.textContent ?? ''));
    if (to !== undefined) {
      const nodes = textNodesOf(el);
      if (nodes.length >= 2) {
        const ws = to.split(/\s+/).filter(Boolean);
        const per = Math.ceil(ws.length / nodes.length);
        nodes.forEach((n, i) => {
          const chunk = ws.slice(i * per, (i + 1) * per).join(' ');
          const value = n.nodeValue ?? '';
          const lead = value.match(/^\s*/)?.[0] ?? '';
          const tail = value.match(/\s*$/)?.[0] ?? '';
          n.nodeValue = chunk ? `${lead}${chunk}${tail || (i < nodes.length - 1 ? ' ' : '')}` : '';
        });
        return;
      }
    }
    for (const child of Array.from(el.children)) spread(child);
  };
  spread(root);

  // 3. Whole text nodes, then a key inside a longer node.
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
  const nodes: Node[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const node of nodes) {
    if (node.nodeType !== TEXT_NODE) continue;
    const parent = node.parentElement;
    if (parent && parent.parentElement && isLetterRow(parent.parentElement)) continue;
    const value = node.nodeValue ?? '';
    const hit = exact.get(norm(value));
    if (hit !== undefined) {
      const lead = value.match(/^\s*/)?.[0] ?? '';
      const tail = value.match(/\s*$/)?.[0] ?? '';
      node.nodeValue = `${lead}${hit}${tail}`;
      continue;
    }
    let next = value;
    for (const { key, to } of entries) {
      if (key.length < 6 || to.toLowerCase().includes(key)) continue;
      const at = next.toLowerCase().indexOf(key);
      if (at >= 0) next = `${next.slice(0, at)}${to}${next.slice(at + key.length)}`;
    }
    if (next !== value) node.nodeValue = next;
  }
}

export const isElement = (n: Node): n is Element => n.nodeType === ELEMENT_NODE;
