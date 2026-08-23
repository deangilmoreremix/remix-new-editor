#!/usr/bin/env node
/**
 * Validates all templates in the Template Studio for required fields.
 * Required: modelType, outputType, basePrompt
 */

import { allTemplates } from '../src/lib/templates.js';
import { TEMPLATE_SPECS, getEnhancedTemplateIds } from '../src/lib/templateSpecs.js';

let totalChecked = 0;
let validTemplates = 0;
const issues = {
  missingModelType: [],
  missingOutputType: [],
  missingBasePrompt: [],
  nullEntries: [],
};

function validateTemplate(template, source) {
  if (!template || typeof template !== 'object') {
    issues.nullEntries.push(source);
    return;
  }

  totalChecked++;

  if (!template.modelType) {
    issues.missingModelType.push({
      id: template.id || 'unknown',
      name: template.name || 'unknown',
      source,
    });
  }

  if (!template.outputType) {
    issues.missingOutputType.push({
      id: template.id || 'unknown',
      name: template.name || 'unknown',
      source,
    });
  }

  if (!template.basePrompt) {
    issues.missingBasePrompt.push({
      id: template.id || 'unknown',
      name: template.name || 'unknown',
      source,
    });
  }

  if (template.modelType && template.outputType && template.basePrompt) {
    validTemplates++;
  }
}

console.log(`\n=== Template Validation Report ===\n`);
console.log(`Total templates in allTemplates: ${allTemplates.length}`);
console.log(`Template specs keys: ${Object.keys(TEMPLATE_SPECS).length}`);
console.log(`Enhanced template IDs: ${getEnhancedTemplateIds().length}\n`);

allTemplates.forEach((t, idx) => {
  const source = `allTemplates[${idx}]`;
  validateTemplate(t, source);
});

console.log(`\n=== Results ===`);
console.log(`Total checked: ${totalChecked}`);
console.log(`Valid (have all 3 fields): ${validTemplates}`);
console.log(`Null/invalid entries: ${issues.nullEntries.length}`);
console.log(`\nMissing modelType: ${issues.missingModelType.length}`);
console.log(`Missing outputType: ${issues.missingOutputType.length}`);
console.log(`Missing basePrompt: ${issues.missingBasePrompt.length}`);

if (issues.missingModelType.length > 0) {
  console.log(`\n--- Templates missing modelType (first 10) ---`);
  issues.missingModelType.slice(0, 10).forEach(t => {
    console.log(`  ${t.id} (${t.name}) - ${t.source}`);
  });
}

if (issues.missingOutputType.length > 0) {
  console.log(`\n--- Templates missing outputType (first 10) ---`);
  issues.missingOutputType.slice(0, 10).forEach(t => {
    console.log(`  ${t.id} (${t.name}) - ${t.source}`);
  });
}

if (issues.missingBasePrompt.length > 0) {
  console.log(`\n--- Templates missing basePrompt (first 10) ---`);
  issues.missingBasePrompt.slice(0, 10).forEach(t => {
    console.log(`  ${t.id} (${t.name}) - ${t.source}`);
  });
}

if (issues.nullEntries.length > 0) {
  console.log(`\n--- Null entries (first 10) ---`);
  issues.nullEntries.slice(0, 10).forEach(source => {
    console.log(`  ${source}`);
  });
}
