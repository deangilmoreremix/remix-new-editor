// Evidence that the repaired templates render the same as the originals: both are compiled with sucrase, run against a stub React +
// Remotion scope at several frames, fully expanded into element trees and compared.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { transform } = require('sucrase');
const rem = require('remotion');
let FRAME = 0;
const cfg = { fps: 30, width: 1920, height: 1080, durationInFrames: 120, id: 'x' };
const el = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) });
const React = { createElement: el, Fragment: 'Fragment', useMemo: (f) => f(), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useEffect() {}, useCallback: (f) => f, useId: () => 'id', Children: { toArray: (c) => [c].flat() } };
const scope = { React, useCurrentFrame: () => FRAME, useVideoConfig: () => cfg, interpolate: rem.interpolate, interpolateColors: rem.interpolateColors, spring: (o) => rem.spring({ ...o, fps: o.fps ?? 30, frame: o.frame ?? FRAME }), Easing: rem.Easing, random: rem.random, Img: 'Img', Video: 'Video', Audio: 'Audio', Sequence: 'Sequence', AbsoluteFill: 'AbsoluteFill', staticFile: (s) => s };
const names = Object.keys(scope);
function build(code) {
  const name = (code.match(/(?:^|\n)\s*(?:const|function)\s+(\w+)/) || [])[1];
  const js = transform(`${code}\nreturn ${name};`, { transforms: ['jsx'], jsxRuntime: 'classic', production: true }).code;
  return new Function(...names, js)(...Object.values(scope));
}
function expand(node, depth = 0) {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((n) => expand(n, depth));
  if (typeof node.type === 'function' && depth < 20) return expand(node.type({ ...node.props, children: node.children }), depth + 1);
  return { type: node.type === React.Fragment ? 'Fragment' : node.type, props: JSON.parse(JSON.stringify(node.props, (k, v) => (typeof v === 'function' ? 'fn' : v))), children: node.children.map((c) => expand(c, depth)) };
}
const repaired = JSON.parse(fs.readFileSync('public/occ-templates/repaired.json', 'utf8'));
let ok = 0; const bad = [];
for (const f of ['openchatcut', 'social-shorts', 'koubo-scenes']) {
  for (const t of JSON.parse(fs.readFileSync(`public/occ-templates/${f}-templates.json`, 'utf8'))) {
    if (!repaired[t.id]) continue;
    try {
      const A = build(t.code); const B = build(repaired[t.id]);
      let same = true;
      for (const fr of [0, 7, 20, 45, 80]) {
        FRAME = fr; const item = { props: { ...t.props }, width: 1080, height: 1920 };
        if (JSON.stringify(expand(A({ item }))) !== JSON.stringify(expand(B({ item })))) { same = false; break; }
      }
      if (same) ok++; else bad.push(t.id);
    } catch (e) { bad.push(`${t.id} (${e.message.slice(0, 60)})`); }
  }
}
// a repair that is not proven identical (differs, or cannot be exercised by this stub) is dropped: that template stays blocked
if (bad.length && !process.env.DBG) { for (const b of bad) delete repaired[b.split(' ')[0]]; fs.writeFileSync('public/occ-templates/repaired.json', JSON.stringify(repaired)); }
console.log(`identical render trees: ${ok} / ${Object.keys(repaired).length}`);
bad.forEach((b) => console.log(' differs/errors:', b));
if (process.env.DBG) {
  const id = process.env.DBG; const code = Object.entries(repaired).find(([k]) => k === id)?.[1];
  for (const f of ['openchatcut', 'social-shorts', 'koubo-scenes']) for (const t of JSON.parse(fs.readFileSync(`public/occ-templates/${f}-templates.json`, 'utf8'))) if (t.id === id) {
    for (const fr of [0, 7]) { FRAME = fr; const item = { props: { ...t.props }, width: 1080, height: 1920 };
      let a, b; try { a = JSON.stringify(expand(build(t.code)({ item }))); } catch (e) { a = 'ERR A ' + e.message; } try { b = JSON.stringify(expand(build(code)({ item }))); } catch (e) { b = 'ERR B ' + e.message; }
      if (a !== b) { let i = 0; while (a[i] === b[i]) i++; console.log(id, 'frame', fr, '\nA:', a.slice(Math.max(0, i - 80), i + 100), '\nB:', b.slice(Math.max(0, i - 80), i + 100)); break; } }
  }
}
