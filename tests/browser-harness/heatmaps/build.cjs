const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '../../..');
const esbuild = require(`${ROOT}/node_modules/esbuild`);
const S = process.env.HEAT_S || '/tmp/heat-e2e';
fs.mkdirSync(S, { recursive: true });
for (const f of ['entry-watch.js', 'entry-section.jsx', 'entry-campaign.jsx']) fs.writeFileSync(`${S}/${f}`, fs.readFileSync(`${__dirname}/${f}`, 'utf8').replace(/__ROOT__/g, ROOT));
for (const [e, o] of [['entry-watch.js', 'watch.bundle.js'], ['entry-section.jsx', 'section.bundle.js'], ['entry-campaign.jsx', 'campaign.bundle.js']]) {
  esbuild.buildSync({ entryPoints: [`${S}/${e}`], bundle: true, outfile: `${S}/${o}`, format: 'iife', loader: { '.css': 'empty', '.js': 'jsx' }, nodePaths: [`${ROOT}/node_modules`], define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic' });
}
console.log('built');
