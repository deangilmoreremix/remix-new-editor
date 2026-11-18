import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const process_name = process.argv[2] || 'inset-shadow'; const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://127.0.0.1:3199/');
const png = await p.evaluate((n) => window.__poc.still(n, 0), process_name);
writeFileSync('out/diag-' + process_name + '.png', Buffer.from(png, 'base64')); await b.close();
