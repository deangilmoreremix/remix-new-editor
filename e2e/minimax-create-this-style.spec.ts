/* eslint-disable no-undef */
/**
 * Workstream E (QA) — E2E for the Minimax "Create This Style" path.
 *
 * Roadmap refs: §2.4 (CTA contract), §3.3 (frontend flow), §5.3 ("every
 * 'Create This Style' instance registers a Playwright selector (`data-mmx-cta`,
 * `data-studio`)"), §5.4-E ("E2E green for 8 studios").
 *
 * Selector contract asserted here (kept in one place on purpose):
 *   - CTA:  `[data-mmx-cta]` (canonical, see `createStyleLink()` in
 *           src/components/landing/sections/minimax/ui.js) or any
 *           button/anchor whose text is "Create This Style"
 *           (src/lib/examplesRail.js renders the button variant), or
 *           `[data-testid="demo-card-cta"]` for DemoCard.jsx.
 *   - Card:  `[data-mmx-card]`, `[data-demo-slug]`, `[data-style-id]`,
 *            `.sv-example-card`.
 *   - Route hint on the CTA: `data-mmx-route` / `data-studio` / `data-mmx-slug`.
 *
 * Expectations are DATA-DRIVEN: the `targetStudio` values in
 * `src/data/minimax/presets.js` decide where each demo must land, so adding
 * clip #31 never needs a test change (roadmap §5.3 shared invariant).
 *
 * The suite is a runnable skeleton: every studio gets real assertions, but each
 * test self-skips when the dev server / baseURL is unreachable so the file is
 * safe to keep in CI before the dev server is wired up.
 *
 * Known gaps this suite is designed to surface (do not "fix" by loosening):
 *   1. `createThisStyle()` navigates to `styleTemplate.targetStudio`
 *      ("VideoStudio"), while the hash router + `consumeStudioPrefill()` use the
 *      lowercase route ids ("video"). The routing assertion therefore accepts
 *      either spelling but the prefill assertion pins the route the studios
 *      actually read.
 *   2. `createThisStyle()`'s offline fallback imports
 *      `'../data/minimax/presets.js'` from `src/lib/minimax/`, which does not
 *      resolve — the programmatic test reports the thrown error verbatim.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/* ------------------------------------------------------------- preset data */

type Preset = {
  slug: string;
  title: string;
  author: string;
  prompt: string;
  model: string;
  targetStudio: string;
  rightsNote: string;
  sourceClipUrl: string;
};

function repoRoot(): string {
  for (const candidate of [process.cwd(), resolve(process.cwd(), '..'), resolve(process.cwd(), '../..')]) {
    if (existsSync(resolve(candidate, 'playwright.config.js'))) return candidate;
  }
  return process.cwd();
}

const ROOT = repoRoot();

/**
 * Load the presets from `src/data/minimax/presets.js` (the file Workstream C
 * owns). It is generated as a JSON array literal, so the literal is sliced out
 * and parsed instead of importing the module — that keeps this spec free of any
 * app-source module graph / transpile coupling. `presets.json` is the fallback.
 */
function loadPresets(): Preset[] {
  const jsPath = resolve(ROOT, 'src/data/minimax/presets.js');
  try {
    const src = readFileSync(jsPath, 'utf8');
    const start = src.indexOf('[');
    const end = src.lastIndexOf(']');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(src.slice(start, end + 1));
      if (Array.isArray(parsed) && parsed.length) return parsed as Preset[];
    }
  } catch {
    /* fall through to presets.json */
  }
  const jsonPath = resolve(ROOT, 'public/media/minimax-h3/presets.json');
  return JSON.parse(readFileSync(jsonPath, 'utf8')) as Preset[];
}

const PRESETS = loadPresets();

/** targetStudio → { visit: hash route to open, route: route the studio consumes } */
const STUDIOS: Record<string, { visit: string; route: string }> = {
  VideoStudio: { visit: 'video', route: 'video' },
  CinemaStudio: { visit: 'cinema', route: 'cinema' },
  EditStudio: { visit: 'edit', route: 'edit' },
  ImageStudio: { visit: 'image', route: 'image' },
  AudioStudio: { visit: 'audio', route: 'audio' },
  AvatarStudio: { visit: 'avatar', route: 'avatar' },
  CharacterStudio: { visit: 'character', route: 'character' },
  // TemplateStudio is only reachable through a template id (see
  // e2e/studio-video-features.spec.js), and CTA landings keep the `template`
  // prefix.
  TemplateStudio: { visit: 'template/tiktok-video', route: 'template' },
};

const STUDIO_NAMES = Object.keys(STUDIOS);

/** First preset that targets a studio — drives that studio's expectations. */
function representative(studio: string): Preset | undefined {
  return PRESETS.find((p) => p.targetStudio === studio);
}

/** studio name for a slug, from the preset data (never hard-coded). */
function targetStudioForSlug(slug: string): string | null {
  const preset = PRESETS.find((p) => p.slug === slug);
  return preset ? preset.targetStudio : null;
}

/* ----------------------------------------------------------------- fixtures */

const CTA_SELECTOR = [
  '[data-mmx-cta]',
  '[data-testid="demo-card-cta"]',
  'button:has-text("Create This Style")',
  'a:has-text("Create This Style")',
].join(', ');

const CARD_SELECTOR = ['[data-mmx-card]', '[data-demo-slug]', '[data-style-id]', '.sv-example-card'].join(', ');

const PROMPT_SELECTOR = [
  '[data-testid="prompt-input"]',
  'textarea[aria-label*="prompt" i]',
  'textarea[placeholder*="prompt" i]',
  'textarea[placeholder*="describe" i]',
  'textarea#prompt',
  'textarea[name="prompt"]',
].join(', ');

const PREFILL_KEY = 'sv_studio_prefill';

let serverProbe: Promise<boolean> | null = null;

/** One cheap probe per worker: is the app actually being served? */
function devServerUp(baseURL?: string): Promise<boolean> {
  if (!serverProbe) {
    const url = baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    serverProbe = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok;
      } catch {
        return false;
      }
    })();
  }
  return serverProbe;
}

let moduleProbe: Promise<boolean> | null = null;

/** Vite dev serves raw source modules — needed by the programmatic tests. */
function sourceModulesServed(baseURL?: string): Promise<boolean> {
  if (!moduleProbe) {
    const base = (baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    moduleProbe = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${base}/src/lib/minimax/createThisStyle.js`, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok;
      } catch {
        return false;
      }
    })();
  }
  return moduleProbe;
}

/**
 * Boot the SPA shell on a hash route. Mirrors the proven helper in
 * e2e/studio-video-features.spec.js (the router's initial navigate can race the
 * ModalSystem import, so re-navigate once the shell is ready).
 */
async function gotoStudio(page: any, route: string) {
  await page.goto(`/#/${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(
    () => !!document.getElementById('content-area') && typeof (window as any).__debugNavigate === 'function',
    null,
    { timeout: 15000 }
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate((r: string) => {
      try {
        (window as any).__debugNavigate(r);
      } catch {
        /* ignore */
      }
    }, route);
    try {
      await page.waitForFunction(
        () => {
          const main = document.querySelector('main');
          if (document.querySelector('.animate-spin')) return false;
          return !!main && main.children.length > 0 && (main.textContent || '').trim().length > 50;
        },
        null,
        { timeout: 10000 }
      );
      return;
    } catch (err) {
      if (attempt === 2) throw err;
      await page.waitForTimeout(1500);
    }
  }
}

async function readStagedPrefill(page: any) {
  return page.evaluate((key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return (window as any).__svStudioPrefill || null;
  }, PREFILL_KEY);
}

/** First non-empty prompt field on the page (studios use varying labels). */
async function promptFieldValue(page: any): Promise<string> {
  return page.evaluate((sel: string) => {
    const els = Array.from(document.querySelectorAll(sel)) as HTMLTextAreaElement[];
    for (const el of els) {
      const value = (el.value || el.textContent || '').trim();
      if (value) return value;
    }
    return '';
  }, PROMPT_SELECTOR);
}

/** Whatever the destination studio can prove about a pre-fill. */
async function prefillEvidence(page: any) {
  const [staged, prompt, hash] = await Promise.all([
    readStagedPrefill(page),
    promptFieldValue(page),
    page.evaluate(() => window.location.hash),
  ]);
  const template = await page.evaluate(() => (window as any).__svActiveStyleTemplate || null);
  return { staged, prompt, hash, template };
}

/* -------------------------------------------------------------- data sanity */

test.describe('Minimax presets — studio mapping data', () => {
  test('every one of the 8 target studios has at least one preset', async () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(30);
    const targets = new Set(PRESETS.map((p) => p.targetStudio));
    for (const studio of STUDIO_NAMES) {
      expect(targets, `no preset targets ${studio}`).toContain(studio);
    }
    // No preset may point at a studio this suite cannot route to.
    for (const p of PRESETS) {
      expect(STUDIOS[p.targetStudio], `${p.slug}: unknown targetStudio ${p.targetStudio}`).toBeTruthy();
    }
  });
});

/* ---------------------------------------------- per-studio CTA presence/flow */

for (const studio of STUDIO_NAMES) {
  const { visit, route } = STUDIOS[studio];
  const preset = representative(studio);

  test.describe(`${studio} — "Create This Style"`, () => {
    test(`renders a demo card CTA at #/${visit}`, async ({ page, baseURL }) => {
      test.skip(!(await devServerUp(baseURL)), 'dev server / baseURL unavailable');
      expect(preset, `presets.js has no preset targeting ${studio}`).toBeTruthy();

      await gotoStudio(page, visit);

      const cta = page.locator(CTA_SELECTOR);
      await expect(cta.first(), `no "Create This Style" CTA in ${studio} (expected ${CTA_SELECTOR})`).toBeVisible({
        timeout: 15000,
      });
      // The CTA must sit inside a demo card so keyboard users get card context.
      await expect(page.locator(CARD_SELECTOR).first()).toBeAttached();
      // Accessible name is part of the contract (§2.4 / §5.3).
      const accessibleName = (await cta.first().getAttribute('aria-label')) || (await cta.first().innerText());
      expect(accessibleName.trim().length, 'CTA has no accessible name').toBeGreaterThan(0);
    });

    test(`clicking the CTA opens the mapped studio pre-filled`, async ({ page, baseURL }) => {
      test.skip(!(await devServerUp(baseURL)), 'dev server / baseURL unavailable');
      expect(preset).toBeTruthy();

      await gotoStudio(page, visit);

      const cta = page.locator(CTA_SELECTOR).first();
      await expect(cta, `no CTA to click in ${studio}`).toBeVisible({ timeout: 15000 });

      // Resolve the expected destination from the CTA's own data attributes,
      // falling back to the preset mapping (never a hard-coded studio).
      const hints = await cta.evaluate((el: HTMLElement) => {
        const card = el.closest('[data-mmx-card],[data-demo-slug],[data-style-id],.sv-example-card') as HTMLElement | null;
        return {
          route: el.dataset.mmxRoute || el.dataset.studio || null,
          slug:
            el.dataset.mmxSlug ||
            el.dataset.demoSlug ||
            (card && (card.dataset.demoSlug || card.dataset.mmxSlug || card.dataset.styleId)) ||
            null,
        };
      });

      const slug = (hints.slug || '').replace(/^minimax-h3-/, '');
      const mappedStudio = slug ? targetStudioForSlug(slug) : null;
      const expectedStudio = mappedStudio || studio;
      const expectedRoute = hints.route || STUDIOS[expectedStudio].route;

      await cta.click();

      // Route assertion: the hash must land on the mapped studio. Both the
      // router id ("video") and the raw targetStudio ("VideoStudio") are
      // accepted because createThisStyle() currently navigates with the latter.
      const routePattern = new RegExp(`#/(${expectedRoute}|${expectedStudio})`, 'i');
      await expect
        .poll(async () => page.evaluate(() => window.location.hash), {
          timeout: 15000,
          message: `CTA in ${studio} did not route to ${expectedStudio} (${expectedRoute})`,
        })
        .toMatch(routePattern);

      // Pre-fill assertion: either the studio consumed the payload (prompt
      // populated) or the payload is still staged for the mapped route.
      const evidence = await prefillEvidence(page);
      const stagedRoute = evidence.staged && evidence.staged.route;
      const prefilled =
        evidence.prompt.length > 0 ||
        (!!stagedRoute && String(stagedRoute).toLowerCase().includes(expectedRoute.toLowerCase()));

      expect(
        prefilled,
        `${expectedStudio} opened empty: prompt="${evidence.prompt}" staged=${JSON.stringify(evidence.staged)}`
      ).toBe(true);

      if (evidence.staged) {
        expect(evidence.staged.ref || '').toContain('minimax');
      }
    });
  });
}

/* ------------------------------------- programmatic contract (all 8 studios) */

test.describe('createThisStyle() contract', () => {
  for (const studio of STUDIO_NAMES) {
    const preset = representative(studio);

    test(`createThisStyle("${preset ? preset.slug : studio}") stages + routes to ${studio}`, async ({
      page,
      baseURL,
    }) => {
      test.skip(!(await devServerUp(baseURL)), 'dev server / baseURL unavailable');
      test.skip(!(await sourceModulesServed(baseURL)), 'source modules are not served (production build)');
      expect(preset).toBeTruthy();

      await gotoStudio(page, 'video');

      const result = await page.evaluate(async ({ slug, key }: { slug: string; key: string }) => {
        try {
          const mod = await import(/* @vite-ignore */ '/src/lib/minimax/createThisStyle.js');
          const out = await mod.createThisStyle(slug);
          let staged: any = null;
          try {
            const raw = localStorage.getItem(key);
            staged = raw ? JSON.parse(raw) : (window as any).__svStudioPrefill || null;
          } catch {
            staged = (window as any).__svStudioPrefill || null;
          }
          return {
            error: null as string | null,
            hash: window.location.hash,
            staged,
            template: out && out.styleTemplate ? out.styleTemplate : null,
            draftId: out ? out.draftId : null,
          };
        } catch (err: any) {
          return {
            error: String((err && err.message) || err),
            hash: window.location.hash,
            staged: null,
            template: null,
            draftId: null,
          };
        }
      }, { slug: preset!.slug, key: PREFILL_KEY });

      expect(result.error, `createThisStyle("${preset!.slug}") threw: ${result.error}`).toBeNull();
      expect(result.draftId, 'no draftId returned').toBeTruthy();
      expect(result.template && result.template.targetStudio).toBe(studio);
      expect(result.hash, `hash "${result.hash}" is not ${studio}`).toMatch(
        new RegExp(`#/(${STUDIOS[studio].route}|${studio})`, 'i')
      );

      // The staged payload is the studio hand-off contract (§3.3): prompt +
      // model + aspect must survive it.
      expect(result.staged, 'nothing staged for the destination studio').toBeTruthy();
      expect(String(result.staged.route).toLowerCase()).toContain(STUDIOS[studio].route.toLowerCase());
      expect(result.staged.params && result.staged.params.prompt, 'staged prompt missing').toBeTruthy();
      expect(result.staged.model || (result.template && result.template.model)).toBeTruthy();
      expect(result.staged.params && result.staged.params._sourceSlug).toBe(preset!.slug);
    });
  }

  /**
   * Licensing contract (roadmap §4 + §5.4-E: "export of a non-redistributable
   * clip carries credit"). This is EXPECTED TO FAIL today: createThisStyle()
   * sets `derivativeOnly` but does not forward `author` / `rightsNote` into the
   * staged payload, so the destination studio has no credit string to stamp on
   * an export. `test.fail()` keeps the gap visible and flips to a reported
   * "passed unexpectedly" the moment Workstream C wires the credit through.
   * See scripts/check-minimax-licensing.js for the static version of this gate.
   */
  test('staged prefill carries author credit for a derivative-only clip', async ({ page, baseURL }) => {
    test.skip(!(await devServerUp(baseURL)), 'dev server / baseURL unavailable');
    test.skip(!(await sourceModulesServed(baseURL)), 'source modules are not served (production build)');
    test.fail(true, 'known gap: author/rightsNote are not forwarded to the studio prefill');

    const preset = PRESETS[0];
    await gotoStudio(page, 'video');

    const staged = await page.evaluate(async ({ slug, key }: { slug: string; key: string }) => {
      const mod = await import(/* @vite-ignore */ '/src/lib/minimax/createThisStyle.js');
      await mod.createThisStyle(slug);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (window as any).__svStudioPrefill || null;
    }, { slug: preset.slug, key: PREFILL_KEY });

    const asText = JSON.stringify(staged || {});
    expect(asText, 'staged payload has no author credit').toContain(preset.author);
    expect(asText, 'staged payload has no rightsNote').toContain('rightsNote');
  });
});

test.afterAll(async ({ browser }) => {
  // Leave no staged prefill / draft behind for the next suite.
  if (!(await devServerUp())) return;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/#/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((key: string) => {
      try {
        localStorage.removeItem(key);
        localStorage.removeItem('prefill_prompt');
      } catch {
        /* ignore */
      }
    }, PREFILL_KEY);
  } catch {
    /* ignore */
  }
  await context.close();
});
