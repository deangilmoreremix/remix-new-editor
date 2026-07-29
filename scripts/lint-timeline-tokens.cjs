#!/usr/bin/env node
/**
 * Token-lint for the Timeline Editor redesign.
 *
 * Guarantees the redesign CSS can never silently fail to render again:
 * every `var(--x)` consumed by styles/timeline-editor-page.css (and any other
 * timeline CSS) MUST be defined in styles/timeline-tokens.css under the SAME
 * (plain) namespace. A missing token = a style that resolves to `invalid` and
 * renders unstyled. This fails the build/CI instead of shipping a broken editor.
 *
 * Usage: node scripts/lint-timeline-tokens.cjs
 * Exit 0 = all tokens resolve; exit 1 = gaps found.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOKENS_FILE = path.join(ROOT, 'styles', 'timeline-tokens.css');
const CONSUMER_FILES = [
  path.join(ROOT, 'styles', 'timeline-editor-page.css'),
  path.join(ROOT, 'styles', 'timeline-tokens.css'),
];

function fail(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

if (!fs.existsSync(TOKENS_FILE)) fail(`Missing tokens file: ${TOKENS_FILE}`);

const tokenSrc = fs.readFileSync(TOKENS_FILE, 'utf8');

// Collect every `--name:` definition (handles multiple per line).
const defined = new Set();
for (const m of tokenSrc.matchAll(/--[a-zA-Z0-9_-]+[ \t]*:/g)) {
  defined.add(m[0].replace(/[ \t]*:/, ''));
}

// Collect every var(--x) used across consumer files.
const used = new Set();
for (const file of CONSUMER_FILES) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)) {
    used.add(m[1]);
  }
}

const missing = [...used].filter((t) => !defined.has(t)).sort();

if (missing.length) {
  console.error('❌ Timeline token resolution failed. Undefined tokens:');
  for (const t of missing) console.error('   - ' + t);
  console.error('\nAdd these to styles/timeline-tokens.css (mirror timeline-redesign-prototype.html).');
  process.exit(1);
}

console.log(`✅ Timeline tokens OK: ${defined.size} defined, ${used.size} referenced, 0 undefined.`);
