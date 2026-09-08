#!/usr/bin/env node
/**
 * Studio API contract audit — verifies every `muapi.xxx(...)` call in
 * `src/components/*.js` matches a method on the exported `MuapiClient`.
 *
 * Exit 0 = clean, exit 1 = mismatches found.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const componentsDir = join(repoRoot, 'src', 'components');

// Load muapi module metadata by parsing the source — avoids executing it
const muapiSource = readFileSync(join(repoRoot, 'src', 'lib', 'muapi.js'), 'utf8');
const clientMethods = new Set();
const methodRegex = /^\s+(?:async\s+)?(\w+)\s*\(/gm;
for (const match of muapiSource.matchAll(methodRegex)) {
  const name = match[1];
  if (name && !['constructor', 'then', 'catch', 'finally'].includes(name)) {
    clientMethods.add(name);
  }
}

const studioFiles = readdirSync(componentsDir).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));
let issues = 0;

for (const file of studioFiles) {
  const fullPath = join(componentsDir, file);
  const content = readFileSync(fullPath, 'utf8');
  const rel = `src/components/${file}`;

  const calls = [...content.matchAll(/muapi\.([A-Za-z_]\w*)\s*\(/g)];
  for (const call of calls) {
    const methodName = call[1];
    if (!clientMethods.has(methodName)) {
      console.error(`[ERROR] ${rel}: calls muapi.${methodName}() but MuapiClient has no such method`);
      issues++;
    }
  }
}

if (issues > 0) {
  console.error(`\nStudio API audit: ${issues} issue(s) found.`);
  process.exit(1);
} else {
  console.log('Studio API audit: all muapi calls match known client methods.');
  process.exit(0);
}
