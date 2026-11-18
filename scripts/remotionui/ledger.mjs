// docs/remotionui-resource-ledger.csv / .md from the catalog + measured verification (one row per RemotionUI component).
import { readFileSync, writeFileSync } from 'node:fs';
const cat = JSON.parse(readFileSync('src/lib/remotionui/catalog.json', 'utf8')).items;
const ver = JSON.parse(readFileSync('src/lib/remotionui/verification.json', 'utf8'));
const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
const rows = cat.map((i) => ({ id: i.id, category: i.category, enabled: i.enabled, slow: i.slow, fps: ver[i.name]?.fps ?? '', editableFields: i.editables.length, reason: i.enabled ? '' : i.reason }));
writeFileSync('docs/remotionui-resource-ledger.csv', ['id,category,enabled,slowExport,exportFps1080p,editableFields,reason', ...rows.map((r) => [r.id, q(r.category), r.enabled ? 'yes' : 'no', r.slow ? 'yes' : '', r.fps, r.editableFields, q(r.reason)].join(','))].join('\n') + '\n');
const by = {}; for (const r of rows) { const k = r.enabled ? 'enabled' : r.reason.startsWith('needs an audio') ? 'needs your own audio/video file' : r.reason.startsWith('needs ') ? 'needs WebGL / map packages' : r.reason.startsWith('MP4 export failed') ? 'export failed' : r.reason.startsWith('export too slow') ? 'export too slow' : 'other'; (by[k] ??= []).push(r); }
let md = `# RemotionUI resource ledger\n\n${rows.length} components from https://remotionui.com (MIT, package \`remotion-ui\`), vendored as pinned source (\`src/lib/remotionui/registry.lock.json\`, sha256 per file).\nEnabled = rendered with no adapter error and not blank in the sandboxed preview frame, **and** a real full-length 1080p MP4 export succeeded in the browser at >= 3 fps. Items below 8 fps are enabled and marked "slower export".\n\n| Status | Count |\n|---|---|\n`;
for (const [k, v] of Object.entries(by)) md += `| ${k} | ${v.length} |\n`;
md += '\n## Not enabled\n\n| id | reason |\n|---|---|\n' + rows.filter((r) => !r.enabled).map((r) => `| ${r.id} | ${r.reason} |`).join('\n') + '\n';
writeFileSync('docs/remotionui-resource-ledger.md', md);
console.log(Object.entries(by).map(([k, v]) => `${k}: ${v.length}`).join(', '));
