#!/usr/bin/env node
/**
 * Studio import audit — guards against recurring model-selector wiring bugs:
 *
 *   1. `renderProviderLogoImg(...)` used but not imported from `modelSelectorUI.js`
 *   2. `_modelSelectorOutsideClickHandler` assigned without a `let`/`const` declaration
 *   3. `getModelLogoHtml` imported but never called
 *
 * Exit 0 = clean, exit 1 = issues found.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');
const componentsDir = join(repoRoot, 'src', 'components');
const MODEL_SELECTOR_UI = '../lib/modelSelectorUI.js';

let issues = 0;
const checked = new Set();

function isJsFile(entry) {
  return entry.endsWith('.js') && !entry.endsWith('.test.js') && !entry.endsWith('.spec.js');
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (!isJsFile(entry)) continue;
    const rel = full.slice(repoRoot.length + 1);
    if (checked.has(rel)) continue;
    checked.add(rel);
    checkFile(full, rel);
  }
}

function checkFile(filePath, rel) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  // Only check studio-like components
  const isStudio = /Studio\.js$|Page\.js$|Panel\.js$|Modal\.js$/.test(filePath);
  if (!isStudio) return;

  const importsModelSelectorUI = /from\s+['"]\.\.\/lib\/modelSelectorUI\.js['"]/.test(content);
  const usesLogoFn = /renderProviderLogoImg\(/.test(content);

  // --- Check 1: renderProviderLogoImg usage vs import ---
  if (usesLogoFn && !importsModelSelectorUI) {
    console.error(`[ERROR] ${rel}: uses renderProviderLogoImg() but does not import from ${MODEL_SELECTOR_UI}`);
    issues++;
  } else if (usesLogoFn && importsModelSelectorUI) {
    // Import exists, verify renderProviderLogoImg is in the import specifier list
    const importLines = content.split('\n').filter(l => /from\s+['"]\.\.\/lib\/modelSelectorUI\.js['"]/.test(l));
    const hasLogoFnImport = importLines.some(l => /\brenderProviderLogoImg\b/.test(l));
    if (!hasLogoFnImport) {
      console.error(`[ERROR] ${rel}: uses renderProviderLogoImg() but import from ${MODEL_SELECTOR_UI} does not include it`);
      issues++;
    }
  }

  // --- Check 2: _modelSelectorOutsideClickHandler declaration ---
  const assignsHandler = /_modelSelectorOutsideClickHandler\s*=/.test(content);
  const declaresHandler = /(let|const|var)\s+_modelSelectorOutsideClickHandler\s*=/.test(content);

  if (assignsHandler && !declaresHandler) {
    console.error(`[ERROR] ${rel}: assigns to _modelSelectorOutsideClickHandler without declaring it`);
    issues++;
  }

  // --- Check 3: getModelLogoHtml import vs usage ---
  const importsLogoHtml = /getModelLogoHtml/.test(content);
  const usesLogoHtml = /getModelLogoHtml\(/.test(content);

  if (importsLogoHtml && !usesLogoHtml) {
    console.error(`[ERROR] ${rel}: imports getModelLogoHtml but never calls it`);
    issues++;
  }
}

walk(componentsDir);

if (issues > 0) {
  console.error(`\nStudio import audit: ${issues} issue(s) found.`);
  process.exit(1);
} else {
  console.log('Studio import audit: clean.');
  process.exit(0);
}
