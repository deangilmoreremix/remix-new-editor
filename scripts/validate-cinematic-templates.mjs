#!/usr/bin/env node
/**
 * Validates all cinematic templates via the adapter path.
 *
 * Cinematic templates live in src/lib/cinematicTemplates.js and lack
 * `modelType` / `basePrompt` directly. The adapter (adaptCinematicTemplateLegacy)
 * synthesizes those fields, so we must validate the ADAPTED output, not the
 * raw template objects.
 *
 * Usage:  node scripts/validate-cinematic-templates.mjs
 * Exit:   0 on success, 1 if any template fails validation.
 */

import {
  CINEMATIC_TEMPLATES,
} from '../src/lib/cinematicTemplates.js';
import {
  adaptCinematicTemplateLegacy,
} from '../src/lib/templateAdapter.js';

const REQUIRED_FIELDS = ['modelType', 'outputType', 'basePrompt'];

function validateAdapted(template) {
  const issues = [];
  for (const field of REQUIRED_FIELDS) {
    if (template[field] === undefined || template[field] === null || template[field] === '') {
      issues.push(`missing ${field}`);
    }
  }
  if (template.outputType && !['video', 'image', 'audio', 'text'].includes(template.outputType)) {
    issues.push(`unexpected outputType: ${template.outputType}`);
  }
  if (template.modelType && !['t2i', 'i2v', 't2v', 'tts', 'llm'].includes(template.modelType)) {
    issues.push(`unexpected modelType: ${template.modelType}`);
  }
  return issues;
}

function main() {
  const raw = CINEMATIC_TEMPLATES;
  console.log(`Raw cinematic templates: ${raw.length}`);

  const rawMissingFields = raw.filter(t =>
    !t?.modelType || !t?.outputType || !t?.basePrompt
  ).length;
  console.log(`Raw templates missing required fields: ${rawMissingFields} (expected: synthesized by adapter)`);

  const adapted = raw.map(adaptCinematicTemplateLegacy);

  const failures = [];
  adapted.forEach((t, i) => {
    const issues = validateAdapted(t);
    if (issues.length > 0) {
      failures.push({ idx: i, id: t.id, name: t.name, issues });
    }
  });

  console.log(`\nAdapted cinematic templates: ${adapted.length}`);
  console.log(`Pass: ${adapted.length - failures.length}/${adapted.length}`);
  console.log(`Fail: ${failures.length}/${adapted.length}`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  [${f.idx}] ${f.id} (${f.name}): ${f.issues.join(', ')}`);
    }
    process.exit(1);
  }

  const modelTypes = new Set(adapted.map(t => t.modelType));
  const outputTypes = new Set(adapted.map(t => t.outputType));
  console.log(`\nDistinct modelTypes: ${[...modelTypes].join(', ')}`);
  console.log(`Distinct outputTypes: ${[...outputTypes].join(', ')}`);

  const allHaveBasePrompt = adapted.every(t => typeof t.basePrompt === 'string' && t.basePrompt.length > 0);
  console.log(`All have non-empty basePrompt: ${allHaveBasePrompt}`);

  console.log('\nAll cinematic templates validate successfully via adapter path.');
}

main();
