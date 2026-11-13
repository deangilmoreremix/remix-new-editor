const esbuild = require('/home/user/wt-stage7/node_modules/esbuild');
const S = '/tmp/heat-e2e';
for (const [e, o] of [['entry-watch.js', 'watch.bundle.js'], ['entry-section.jsx', 'section.bundle.js']]) {
  esbuild.buildSync({ entryPoints: [`${S}/${e}`], bundle: true, outfile: `${S}/${o}`, format: 'iife', loader: { '.css': 'empty', '.js': 'jsx' }, nodePaths: ['/home/user/wt-stage7/node_modules'], define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic' });
}
console.log('built');
