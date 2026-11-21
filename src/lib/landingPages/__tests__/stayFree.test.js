// @vitest-environment node
// Video Pages are free for every user, for every video and picture they create. This walks the feature's code
// so a plan check or upgrade prompt cannot be added later without someone changing this test on purpose.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const PAYWALL = ['requireEntitlement', 'requireApiEntitlement', 'hasSmartVideoGo', 'SMARTVIDEO_GO', 'upgradeRequired', 'PAYMENT_REQUIRED', 'openUpgradeModal', 'isPaid', 'isPro', 'subscription'];

const files = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = `${dir}/${e.name}`;
  if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : files(rel);
  return /\.(js|jsx|ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [rel] : [];
});

describe('Video Pages stay free', () => {
  it('the landing page library, studio and sync function contain no plan check or upgrade prompt', () => {
    const targets = [...files('src/lib/landingPages'), 'src/components/LandingPagesStudio.js', 'src/pages/VideoPage.jsx', 'netlify/functions/landing-sync.js'];
    expect(targets.length).toBeGreaterThan(10);
    const hits = [];
    for (const rel of targets) {
      const src = readFileSync(join(root, rel), 'utf-8');
      for (const token of PAYWALL) if (new RegExp(`\\b${token}\\b`).test(src)) hits.push(`${rel} -> ${token}`);
    }
    expect(hits, `Video Pages are free; no paywall may be added:\n  ${hits.join('\n  ')}`).toEqual([]);
  });
});
