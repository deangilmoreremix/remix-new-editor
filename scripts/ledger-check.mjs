#!/usr/bin/env node
// Validates docs/timeline-feature-ledger.json and regenerates docs/timeline-feature-completion.md.
// Rules (from the completion criteria): VERIFIED needs tests + evidence (a docs/evidence path or a commit); BLOCKED needs an exact blocker;
// NOT_APPLICABLE needs a reason; a feature is never counted VERIFIED while it lists missing functionality as a blocker.
import { readFileSync, writeFileSync } from 'node:fs';
const ledgerPath = new URL('../docs/timeline-feature-ledger.json', import.meta.url);
const docPath = new URL('../docs/timeline-feature-completion.md', import.meta.url);
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const errors = [];
const seen = new Set();
for (const f of ledger.features) {
  if (seen.has(f.id)) errors.push(`${f.id}: duplicate id`);
  seen.add(f.id);
  if (!ledger.statuses.includes(f.status)) errors.push(`${f.id}: unknown status ${f.status}`);
  if (f.status === 'VERIFIED') {
    if (!f.testsPerformed?.trim()) errors.push(`${f.id}: VERIFIED without testsPerformed`);
    if (!/docs\/evidence|commit|commits/i.test(f.evidence ?? '')) errors.push(`${f.id}: VERIFIED without evidence (docs/evidence path or commit)`);
    if (f.blocker) errors.push(`${f.id}: VERIFIED but has a blocker`);
  }
  if (f.status === 'BLOCKED' && !f.blocker?.trim()) errors.push(`${f.id}: BLOCKED without an exact blocker`);
  if (f.status === 'NOT_APPLICABLE' && !(f.blocker || f.missing || f.originalFunctionality)?.trim()) errors.push(`${f.id}: NOT_APPLICABLE without reason`);
}
const count = {};
for (const f of ledger.features) count[f.status] = (count[f.status] ?? 0) + 1;
const lines = [];
lines.push('# Timeline Studio Editor — feature completion ledger', '', `Generated from \`docs/timeline-feature-ledger.json\` by \`scripts/ledger-check.mjs\` (branch \`${ledger.branch}\`, OpenChatCut upstream \`${ledger.upstreamCommit.OpenChatCut.slice(0, 7)}\`).`, '', '**Never read PARTIAL / IMPLEMENTED_UNVERIFIED / BLOCKED as done.** Only VERIFIED rows have tests and evidence recorded.', '', '## Totals', '', '| Status | Count |', '|---|---|');
for (const s of ledger.statuses) lines.push(`| ${s} | ${count[s] ?? 0} |`);
lines.push(`| **All** | ${ledger.features.length} |`, '');
for (const fam of [...new Set(ledger.features.map((f) => f.family))]) {
  lines.push(`## ${fam}`, '');
  for (const f of ledger.features.filter((x) => x.family === fam)) {
    lines.push(`### ${f.id} — ${f.status}`, '', `- Source (${f.sourceRepo}): ${f.sourcePaths.join(', ')}`, `- Target: ${f.targetPaths.join(', ') || '—'}`, `- Original: ${f.originalFunctionality}`, `- Browser: ${f.browserCompatibility} · Backend: ${f.backendDependencies}`,
      `- UI: ${f.uiIntegration || '—'} · Persistence: ${f.persistence || '—'} · Preview: ${f.preview || '—'} · Export: ${f.exportPublish || '—'}`, `- Tests: ${f.testsPerformed || '—'}`, `- Evidence: ${f.evidence || '—'}`);
    if (f.missing) lines.push(`- **Missing:** ${f.missing}`);
    if (f.blocker) lines.push(`- **Blocker:** ${f.blocker}`);
    lines.push('');
  }
}
writeFileSync(docPath, lines.join('\n'));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`ledger ok: ${ledger.features.length} features`, count);
