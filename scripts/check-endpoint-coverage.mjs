// Check which endpoints in models.js have proper normalization mappings
import fs from 'fs';
import path from 'path';

const modelsPath = path.join(process.cwd(), 'src/lib/models.js');
const proxyPath = path.join(process.cwd(), 'supabase/functions/muapi-proxy/index.ts');

const modelsContent = fs.readFileSync(modelsPath, 'utf8');
const proxyContent = fs.readFileSync(proxyPath, 'utf8');

// Extract endpoints from models.js
const endpointMatches = modelsContent.match(/"endpoint":\s*"([^"]+)"/g) || [];
const endpoints = [...new Set(endpointMatches.map(m => m.match(/"endpoint":\s*"([^"]+)"/)[1]))];

// Extract normalization map from proxy
const mapEntries = {};
const mapMatches = proxyContent.match(/'([^']+)':\s*'([^']+)'/g) || [];
for (const match of mapMatches) {
  const [, key, value] = match.match(/'([^']+)':\s*'([^']+)'/);
  mapEntries[key] = value;
}

console.log('=== Endpoint Coverage Analysis ===\n');
console.log(`Total unique endpoints in models.js: ${endpoints.length}`);
console.log(`Normalization mappings in proxy: ${Object.keys(mapEntries).length}\n`);

// Find endpoints that need normalization
const legacySuffixes = ['-image', '-video', '-i2i', '-i2v', '-v2v'];
const potentiallyLegacy = endpoints.filter(ep => 
  legacySuffixes.some(suffix => ep.endsWith(suffix) && !mapEntries[ep])
);

console.log('Potentially legacy endpoints without normalization mapping:');
if (potentiallyLegacy.length === 0) {
  console.log('  None - all legacy-style endpoints are mapped!');
} else {
  for (const ep of potentiallyLegacy) {
    let suggested = ep
      .replace(/-image$/, '')
      .replace(/-video$/, '')
      .replace(/-i2i$/, '')
      .replace(/-i2v$/, '')
      .replace(/-v2v$/, '');
    console.log(`  ${ep} → ${suggested} (not mapped)`);
  }
}

console.log('\nCurrent normalization map:');
for (const [from, to] of Object.entries(mapEntries)) {
  console.log(`  ${from} → ${to}`);
}
