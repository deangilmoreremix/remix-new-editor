// Writes mcp/COVERAGE.md from mcp/studios.json and, when present, the live mcp/smoke-results.json.
// A dry-run report (mcp/smoke-results.dry-run.json) is never read here.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { renderCoverage } from '../packages/studio-mcp-core/src/coverage.js';
import { brand } from '../mcp/brand.js';
import { customTools } from '../mcp/tools.js';

const root = new URL('../mcp/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('studios.json', root), 'utf8'));
const resultsPath = new URL('smoke-results.json', root);
const report = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : null;
if (report?.dryRun) console.warn('smoke-results.json is a dry run; ignoring it.');

const features = Object.entries(manifest.features || {}).map(([id, g]) => {
  const rows = Object.entries(g.items).map(([name, v]) => `| ${name.replace(/\|/g, '/')} | ${v.tools ? v.tools.map((t) => `\`${t}\``).join(', ') : 'not exposed'} | ${v.notExposed ? String(v.notExposed).replace(/\|/g, '/') : 'not run'} |`);
  return `### ${g.title}\n\n| Feature | Tools | Reason / Live |\n|---|---|---|\n${rows.join('\n')}\n`;
}).join('\n');
const featuresSection = features ? `\n## Features\n\nEvery tool is listed under a feature, or the feature says why it is not exposed. Live status is "not run" until a real smoke run records it. Tab tools (timeline, workbench, motion director, render queue, brand) only work while that studio is open in a signed-in tab with "Let MCP control this tab" switched on.\n\n${features}` : '';
writeFileSync(new URL('COVERAGE.md', root), renderCoverage({ manifest, report, customToolNames: new Set(customTools.map((t) => t.name)), brandName: brand.name }) + featuresSection);
console.log(`mcp/COVERAGE.md: ${Object.keys(manifest.supported).length} supported, ${Object.keys(manifest.unsupported).length} not exposed${report && !report.dryRun ? ', live results from ' + report.generatedAt : ', no live results'}`);
