// Generates one demo module per RemotionUI item from the docs' usage example, so every component renders with the sample props and
// children its authors show (the registry itself ships no demo data). Overrides from the inspector are spread onto the root element.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { splitSnippet, openingTag, firstElementEnd } from './jsx.mjs';
import { SAMPLES, SAMPLE_IMPORTS, OVERRIDES, UNDEFINED_OK, TEXT_WRAPPERS } from './samples.mjs';

const usage = JSON.parse(readFileSync('src/lib/remotionui/docs-usage.json', 'utf8')).items;
const cat = JSON.parse(readFileSync('src/lib/remotionui/catalog.json', 'utf8')).items;
const D = 'src/lib/editor/remotion/remotionui/demos';
rmSync(D, { recursive: true, force: true }); mkdirSync(D, { recursive: true });
const SHIM = '../shim';
const COMMON = ['AbsoluteFill', 'Sequence', 'Img', 'interpolate', 'spring', 'Easing', 'useCurrentFrame', 'staticFile', 'OffthreadVideo', 'random', 'interpolateColors', 'Series', 'Freeze', 'Loop'];
const importedNames = (imps) => new Set([...imps.matchAll(/import\s+(?:\{([^}]*)\}|(\w+))/g)].flatMap((m) => (m[1] ? m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()) : [m[2]])));
const STUB = `const __Stub = (label) => function Stub() { return (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 72, fontWeight: 700, textShadow: '0 4px 24px rgba(0,0,0,.45)' }}>{label.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>); };`;
let n = 0; const failures = []; const skipped = {};
for (const it of cat) {
  const u = usage[it.name]; if (!u || !u.usage.length || it.needs.length) continue;
  const snippet = u.usage[u.usage.length - 1];
  const { imports, body: raw } = splitSnippet(snippet);
  const body0 = raw.replace(/^\s*\/\/.*$/gm, '').trim(); const tag0 = openingTag(body0);
  const body = tag0 ? (body0.slice(0, tag0.start) + body0.slice(tag0.start, firstElementEnd(body0.slice(tag0.start)) + tag0.start)).trim() : body0;
  const imps = imports.replace(/from\s+(["'])remotion\1/g, `from "${SHIM}"`)
    .replace(/from\s+(["'])@\/(?:remotion\/)?([^"']+)\1/g, (_, q, p) => `from "../vendored/${p}"`);
  const isTransition = it.category === 'Transitions';
  if (/staticFile\(|\baudioSrc\b/.test(body)) { skipped[it.name] = 'needs an audio or video file that is not part of the library'; continue; }
  const used = (id) => new RegExp(`(?<![\\w.])${id}\\b`).test(body);
  const declaredEarly = new Set([...body.matchAll(/(?:const|let|function)\s+(?:\[?\{?\s*)(\w+)/g)].map((m) => m[1]));
  const sampleIds = Object.keys(SAMPLES).filter((id) => used(id) && !declaredEarly.has(id));
  const extraImports = [...new Set(sampleIds.map((id) => SAMPLE_IMPORTS[id]).filter(Boolean).concat(used('easyEase') && !/easyEase/.test(imports) ? [SAMPLE_IMPORTS.easyEase] : []))].join('\n');
  const sampleCode = OVERRIDES[it.name] ?? [...new Set(sampleIds.map((id) => SAMPLES[id]))].concat(UNDEFINED_OK.filter((id) => used(id) && !declaredEarly.has(id)).map((id) => `const ${id} = undefined;`)).join('\n');
  const have = importedNames(imps); const declared = new Set([...body.matchAll(/(?:const|let|function)\s+(\w+)/g)].map((m) => m[1]));
  const useCommon = COMMON.filter((c) => !have.has(c) && new RegExp(`\\b${c}\\b`).test(body));
  const stubs = [...new Set([...body.matchAll(/<([A-Z]\w*)[\s/>]/g)].map((m) => m[1]))].filter((t) => !have.has(t) && !declared.has(t) && !COMMON.includes(t) && t !== 'TransitionSeries');
  const tag = openingTag(body);
  const mainTag = openingTag(body, it.component);
  if (!tag) { failures.push(`${it.name}: no JSX element in the usage example`); continue; }
  const before = body.slice(0, tag.start).trim();
  let jsx = body.slice(tag.start);
  let src;
  if (isTransition) {
    const ti = body.search(/<TransitionSeries\.Transition[\s/>]/); if (ti >= 0) { const sub = body.slice(ti); jsx = sub.slice(0, firstElementEnd(sub)); }
    src = `import React from 'react';\nimport { AbsoluteFill } from 'remotion';\n${have.has('TransitionSeries') ? '' : "import { TransitionSeries } from '@remotion/transitions';\n"}import { useVideoConfig } from '${SHIM}';\n${imps}\n` +
      `const Scene = ({ a, text, color }) => (<AbsoluteFill style={{ background: color, color: '#fff', fontFamily: 'system-ui,sans-serif', fontSize: 120, fontWeight: 800, alignItems: 'center', justifyContent: 'center' }}>{text}</AbsoluteFill>);\n` +
      `export function Demo({ textA = 'Scene A', textB = 'Scene B', colorA = '#2563eb', colorB = '#f97316' }) {\n  const { durationInFrames } = useVideoConfig();\n  const half = Math.max(60, Math.floor(durationInFrames * 0.62));\n  return (\n    <TransitionSeries>\n      <TransitionSeries.Sequence durationInFrames={half}><Scene a text={textA} color={colorA} /></TransitionSeries.Sequence>\n      ${jsx}\n      <TransitionSeries.Sequence durationInFrames={half}><Scene text={textB} color={colorB} /></TransitionSeries.Sequence>\n    </TransitionSeries>\n  );\n}\n`;
  } else {
    const m2 = mainTag || tag; const off = m2.start - tag.start; let withOverrides = `${jsx.slice(0, m2.close - tag.start)} {...__o}${jsx.slice(m2.close - tag.start)}`;
    if (TEXT_WRAPPERS.includes(it.name)) { let n = 0; withOverrides = withOverrides.replace(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g, (_, t) => { n++; return `>{__o.text${n} ?? ${JSON.stringify(t.trim())}}<`; }); }
    const pre = `${extraImports ? extraImports + '\n' : ''}${useCommon.length ? `import { ${useCommon.join(', ')} } from "${SHIM}";\n` : ''}${stubs.length ? STUB + '\n' + stubs.map((t) => `const ${t} = __Stub(${JSON.stringify(t)});`).join('\n') + '\n' : ''}`;
    src = `import React from 'react';\n${imps}\n${pre}// GENERATED from the RemotionUI docs usage example for "${it.name}" (src/lib/remotionui/docs-usage.json)\nexport function Demo(__o) {\n${sampleCode ? sampleCode.split('\n').map((l) => '  ' + l).join('\n') + '\n' : ''}${before ? before.split('\n').map((l) => '  ' + l).join('\n') + '\n' : ''}  return (\n    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>\n${withOverrides.split('\n').map((l) => '      ' + l).join('\n')}\n    </div>\n  );\n}\n`;
  }
  writeFileSync(`${D}/${it.name}.jsx`, `/* eslint-disable */\n${src}`); n++;
}
writeFileSync('src/lib/remotionui/skipped.json', JSON.stringify(skipped, null, 1));
console.log(`demos: ${n} written, ${Object.keys(skipped).length} need media, ${failures.length} skipped`); failures.forEach((f) => console.log('  ' + f));
