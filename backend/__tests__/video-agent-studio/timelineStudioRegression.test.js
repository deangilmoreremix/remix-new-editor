// Phase 23 + 26 regression test.
//
// Asserts that the Video Agent Studio integration did NOT alter:
//
//   - the 'timeline' route loader (TimelineEditorPage.jsx)
//   - the TimelineFeatureApi surface
//   - the existence of TimelineEditorPage.jsx
//
// If this test starts failing it means the integration has either
// deleted or replaced a protected file.

import { describe, it, expect } from '@jest/globals';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '..', '..', '..');

const TIMELINE_EDITOR_PAGE = resolve(REPO_ROOT, 'src/components/TimelineEditorPage.jsx');
const TIMELINE_FEATURE_API = resolve(REPO_ROOT, 'src/lib/editor/timelineFeatureApi.js');
const ROUTER = resolve(REPO_ROOT, 'src/lib/router.js');

describe('Timeline Studio regression (Video Agent integration must not touch)', () => {
  it('TimelineEditorPage.jsx still exists and is non-trivial', () => {
    expect(existsSync(TIMELINE_EDITOR_PAGE)).toBe(true);
    const size = statSync(TIMELINE_EDITOR_PAGE).size;
    expect(size).toBeGreaterThan(50_000); // 7000+ lines
  });

  it('TimelineFeatureApi still exports the expected class', () => {
    const src = readFileSync(TIMELINE_FEATURE_API, 'utf8');
    expect(src).toMatch(/export\s+class\s+TimelineFeatureApi\b/);
  });

  it("the 'timeline' route in src/lib/router.js still loads TimelineEditorPage.jsx", () => {
    const src = readFileSync(ROUTER, 'utf8');
    expect(src).toMatch(
      /^\s*timeline\s*:\s*\(\)\s*=>\s*import\(['"]\.\.\/components\/TimelineEditorPage\.jsx['"]\)/m,
    );
  });

  it("the 'video-agent' route in src/lib/router.js still loads the original VideoAgentPage.js (Studio 1)", () => {
    const src = readFileSync(ROUTER, 'utf8');
    expect(src).toMatch(
      /^\s*['"]?video-agent['"]?\s*:\s*\(\)\s*=>\s*import\(['"]\.\.\/components\/VideoAgentPage\.js['"]\)/m,
    );
  });

  it("the new 'video-agent-studio' route in src/lib/router.js loads the new OpenChatCut-backed shell (Studio 2)", () => {
    const src = readFileSync(ROUTER, 'utf8');
    expect(src).toMatch(
      /^\s*['"]?video-agent-studio['"]?\s*:\s*\(\)\s*=>\s*import\(['"]\.\.\/components\/VideoAgentStudioShell\.js['"]\)/m,
    );
  });

  it("the legacy VideoAgentPage.js is still present (kept as a migration source)", () => {
    const legacy = resolve(REPO_ROOT, 'src/components/VideoAgentPage.js');
    expect(existsSync(legacy)).toBe(true);
  });
});
