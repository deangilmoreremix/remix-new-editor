// Renders icons/icon.svg to the PNG sizes the dashboard ships (run once; outputs are committed).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => { const svg = fs.readFileSync(path.join(__dirname, 'icons/icon.svg'), 'utf8'); const b = await chromium.launch();
  const sizes = { 'favicon-16x16.png': 16, 'favicon-32x32.png': 32, 'favicon-48x48.png': 48, 'favicon-96x96.png': 96, 'apple-touch-icon.png': 180, 'web-app-manifest-192x192.png': 192, 'web-app-manifest-512x512.png': 512 };
  for (const [name, s] of Object.entries(sizes)) { const p = await b.newPage({ viewport: { width: s, height: s } }); await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`); await p.screenshot({ path: path.join(__dirname, 'icons', name), omitBackground: true }); await p.close(); }
  await b.close(); })();
