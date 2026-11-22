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

writeFileSync(new URL('COVERAGE.md', root), renderCoverage({ manifest, report, customToolNames: new Set(customTools.map((t) => t.name)), brandName: brand.name }));
console.log(`mcp/COVERAGE.md: ${Object.keys(manifest.supported).length} supported, ${Object.keys(manifest.unsupported).length} not exposed${report && !report.dryRun ? ', live results from ' + report.generatedAt : ', no live results'}`);
