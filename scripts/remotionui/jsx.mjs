// Tiny helpers over the docs' usage snippets: split imports from the JSX body and find the first element's opening tag.
export function splitSnippet(code) {
  const lines = code.split('\n'); const imports = []; const rest = [];
  let inImport = false;
  for (const l of lines) {
    if (inImport || /^\s*import\s/.test(l)) { imports.push(l); inImport = !/from\s+["'][^"']+["'];?\s*$|^\s*import\s+["'][^"']+["'];?\s*$/.test(l); continue; }
    rest.push(l);
  }
  return { imports: imports.join('\n'), body: rest.join('\n').trim() };
}
/** Finds the end of the first element's opening tag: returns { start (index of '<'), nameEnd, close (index of '>' or '/>'), selfClosing }. */
export function openingTag(body, name) {
  let start = name ? body.search(new RegExp(`<${name}(?=[\\s/>])`)) : -1;
  if (start < 0) start = body.search(/<[A-Za-z]/);
  if (start < 0) return null;
  let i = start + 1; while (/[\w.]/.test(body[i])) i++;
  const nameEnd = i; let depth = 0; let q = null;
  for (; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === q && body[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++; else if (c === '}') depth--;
    else if (depth === 0 && c === '>') return { start, nameEnd, close: body[i - 1] === '/' ? i - 1 : i, selfClosing: body[i - 1] === '/' };
  }
  return null;
}
/** Literal attributes of the first element: strings, numbers, booleans (everything else is left to the snippet itself). */
export function literalAttrs(body, name) {
  const t = openingTag(body, name); if (!t) return {};
  const attrs = body.slice(t.nameEnd, t.close); const out = {};
  for (const m of attrs.matchAll(/(?:^|\s)(\w+)=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*(-?\d+(?:\.\d+)?)\s*\}|\{\s*(true|false)\s*\})/g)) {
    const key = m[1];
    out[key] = m[2] ?? m[3] ?? m[4] ?? (m[5] !== undefined ? Number(m[5]) : m[6] === 'true');
  }
  let flat = ''; let d = 0; let q = null; // drop strings and {…} so only bare words stay
  for (let i = 0; i < attrs.length; i++) { const c = attrs[i]; if (q) { if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; continue; } if (c === '{') { d++; continue; } if (c === '}') { d--; continue; } if (d === 0) flat += c; }
  for (const m of flat.matchAll(/(?:^|\s)(\w+)(?=\s|$)(?!\s*=)/g)) if (!(m[1] in out)) out[m[1]] = true; // bare boolean (exit)
  return out;
}
/** End index (exclusive) of the first top-level JSX element in `body` (so later statements / second examples are dropped). */
export function firstElementEnd(body) {
  const t = openingTag(body); if (!t) return body.length;
  const name = body.slice(t.start + 1, t.nameEnd);
  if (t.selfClosing) return t.close + 2;
  const re = new RegExp(`<(/?)${name.replace('.', '\\.')}(?=[\\s/>])`, 'g'); re.lastIndex = t.start; let depth = 0; let m;
  while ((m = re.exec(body))) {
    if (m[1] === '/') { depth--; if (depth === 0) return body.indexOf('>', m.index) + 1; } else { const o = openingTag(body.slice(m.index)); if (!o.selfClosing) depth++; else if (depth === 0) return m.index + o.close + 2; }
  }
  return body.length;
}
