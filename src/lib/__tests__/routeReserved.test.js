import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isKnownPage } from '../router.js';

// A studio id is a top-level URL (/image). These names already mean something else on the
// server (functions, static folders, sub-app mounts, public player, built guides), so a studio
// must never take one, or its clean URL would be swallowed.
const RESERVED = [
  'api', 'assets', 'media', 'thumbnails', 'hyperframes', 'studios', 'openthorn', 'smartwarmupai-app',
  'smartwarmupai-help', 'workbench-app', 'motion-agent', 'director-api', 'export-runner', 'code-preview',
  'watch', 'v', 'p', 'vidbee', 'static', 'sw.js', 'manifest.json', 'robots.txt', 'sitemap.xml',
];

describe('studio ids vs reserved server paths', () => {
  it.each(RESERVED)('%s is not a studio route', (name) => {
    expect(isKnownPage(name)).toBe(false);
  });

  it('no studio id is a public/ folder that serves its own index.html', () => {
    const pub = path.resolve(__dirname, '../../../public');
    const clashes = fs.readdirSync(pub, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(pub, d.name, 'index.html')))
      .map((d) => d.name)
      .filter((name) => isKnownPage(name));
    expect(clashes).toEqual([]);
  });
});
