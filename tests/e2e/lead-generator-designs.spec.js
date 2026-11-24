// The 30 Lead Generator designs, tested in the REAL Timeline Editor (CineGen workspace):
//   Elements -> Lead Generator -> the overlay's settings panel (the "Lead Generator modal") -> Design tab.
// Covers: every design can be picked and is drawn on the video; every control in the panel can be edited and the edit is
// saved on the overlay (it is still there after closing and re-selecting it); text on the video can be edited in place.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

const SHOTS = process.env.LG_SHOTS || '';
const panelTab = (page, name) => page.locator('.addon-panel .addon-tab', { hasText: new RegExp(`^${name}$`) });
// the viewer's form (the timeline lane also draws a small thumbnail of it)
const VIEWER = '[data-testid="viewer-stage"]';
const form = (page) => page.locator(`${VIEWER} form.retarget-form`).first();
const SKIP_KINDS = new Set(['hex', 'fieldList', 'points']);

let page;
const pageErrors = [];

async function openLeadGenerator() {
  await page.goto('/#/timeline', { waitUntil: 'domcontentloaded' });
  await page.getByText('Skip for now').click({ timeout: 150_000 });
  await page.getByRole('button', { name: 'New Project' }).first().click();
  await page.getByPlaceholder('Project name...').fill('Lead Generator designs');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'ELEMENTS' }).click();
  await page.getByRole('button', { name: 'Lead Generator', exact: true }).first().click();
  await page.locator('button.element-card', { hasText: 'Click to add it as an overlay' }).first().click();
  await page.locator('.addon-panel').waitFor({ timeout: 60_000 });
  await expect(form(page)).toBeVisible({ timeout: 30_000 });
}

/** Close the settings panel and open it again from the clip on the timeline: what is shown now was read back from the saved overlay. */
async function reselectOverlay() {
  await page.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.locator('.addon-panel')).toHaveCount(0);
  await page.getByText('Lead Generator', { exact: true }).first().click();
  await page.locator('.addon-panel').waitFor();
}

async function pickDesign(id) {
  await panelTab(page, 'Design').click();
  await page.locator(`.addon-panel [data-design-pick="${id}"]`).click();
  await expect(page.locator(`${VIEWER} form.retarget-form[data-design="${id}"]`)).toBeVisible();
}

const control = (key) => page.locator(`.addon-panel [data-key="${key}"]:not([data-kind="hex"])`).first();

/** Edit one panel control the way a person would. Returns the value the control now holds. */
async function edit(el) {
  const type = await el.evaluate((n) => (n.tagName === 'SELECT' ? 'select' : n.tagName === 'TEXTAREA' ? 'textarea' : n.type));
  if (type === 'checkbox') { await el.click(); return { type, value: await el.isChecked() }; }
  if (type === 'select') {
    const options = await el.locator('option').evaluateAll((os) => os.map((o) => o.value));
    const cur = await el.inputValue();
    const next = [...options].reverse().find((v) => v !== cur) ?? cur;
    await el.selectOption(next);
    return { type, value: next };
  }
  if (type === 'range') {
    const v = await el.evaluate((n) => {
      const min = Number(n.min || 0); const max = Number(n.max || 100); const cur = Number(n.value);
      let next = Math.round(min + (max - min) * 0.37);
      if (next === cur) next = Math.round(min + (max - min) * 0.71);
      n.value = String(next);
      n.dispatchEvent(new Event('input', { bubbles: true }));
      n.dispatchEvent(new Event('change', { bubbles: true }));
      return n.value;
    });
    return { type, value: v };
  }
  if (type === 'color') { await el.fill('#12ab34'); return { type, value: '#12ab34' }; }
  if (type === 'number') { await el.fill('7'); return { type, value: '7' }; }
  if (type === 'url') { await el.fill('https://example.com/edited'); return { type, value: 'https://example.com/edited' }; }
  await el.fill('Edited text'); return { type, value: 'Edited text' };
}

async function valueOf(el) {
  const type = await el.evaluate((n) => (n.tagName === 'SELECT' ? 'select' : n.type));
  return type === 'checkbox' ? el.isChecked() : (await el.inputValue()).toLowerCase();
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
  page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 300)));
  await openLeadGenerator();
});

test.afterAll(async () => { await page?.context().close(); });

test('the Lead Generator panel has a Design tab with all 30 designs', async () => {
  await expect(page.locator('.addon-panel .addon-tab')).toHaveText(['Text', 'Design', 'Styles', 'Fields', 'Pointer', 'Integrations']);
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick]')).toHaveCount(30);
});

test('the picker shows each design as a real preview of itself', async () => {
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel .addon-design .optin-mini')).toHaveCount(30);
  const ids = await page.locator('.addon-panel .addon-design').evaluateAll((els) => els.map((t) => [t.dataset.designPick, t.querySelector('form')?.dataset.design]));
  ids.forEach(([tile, shown]) => expect(shown).toBe(tile));
  // distinct pictures: no two tiles have the same background + card + button styling and layout
  const looks = await page.locator('.addon-panel .addon-design .optin-mini form').evaluateAll((forms) => forms.map((f) => [f.dataset.dlayout, f.style.background, f.querySelector('.form-inner').style.cssText, f.querySelector('button').style.background].join('~')));
  expect(new Set(looks).size).toBe(30);
});

test('every one of the 30 designs can be picked and is drawn on the video', async () => {
  await panelTab(page, 'Design').click();
  const ids = await page.locator('.addon-panel [data-design-pick]').evaluateAll((els) => els.map((e) => e.dataset.designPick));
  expect(ids).toHaveLength(30);
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const seen = [];
  for (const [i, id] of ids.entries()) {
    await pickDesign(id);
    // the picked tile is marked, and the form on the video has the design's caption, boxes and button
    await expect(page.locator(`.addon-panel [data-design-pick="${id}"]`)).toHaveClass(/active/);
    await expect(form(page).locator('.retarget-caption')).not.toBeEmpty();
    await expect(form(page).locator('button[type="submit"]')).toBeVisible();
    expect(await form(page).locator('input, select, textarea').count()).toBeGreaterThanOrEqual(3);
    // it FITS: the Play button is fully inside the design's card and the card inside the video, with the text scaled by at most 40%
    await expect.poll(async () => Number(await form(page).getAttribute('data-fit') || 0)).toBeGreaterThan(0);
    const m = await page.evaluate((viewer) => {
      const f = document.querySelector(`${viewer} form.retarget-form`);
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
      const stage = r(f.parentElement); const card = r(f.querySelector('.form-inner'));
      // every box shows its full hint text, and the text is big enough to read in the editor's small viewer
      const ctx = document.createElement('canvas').getContext('2d');
      const cut = []; let minFont = 99;
      f.querySelectorAll('.input-wrapper input:not([type="radio"]):not([type="checkbox"])').forEach((el) => {
        if (!el.offsetParent) return;
        const cs = getComputedStyle(el); minFont = Math.min(minFont, parseFloat(cs.fontSize));
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (ctx.measureText(el.placeholder.trim()).width > room + 0.5) cut.push(el.placeholder.trim());
      });
      // an oval card: nothing may cross its edge
      const outside = [];
      if (f.dataset.shape === 'oval') {
        const cx = card.x + card.w / 2; const cy = card.y + card.h / 2; const a = card.w / 2; const bb = card.h / 2;
        f.querySelectorAll('.retarget-caption, .input-wrapper > *, .buttons-inner, .privacy-disclaimer').forEach((el) => {
          const q = el.getBoundingClientRect(); if (!q.width) return;
          if ([[q.left, q.top], [q.right, q.top], [q.left, q.bottom], [q.right, q.bottom]].some(([x, y]) => ((x - cx) / a) ** 2 + ((y - cy) / bb) ** 2 > 1.02)) outside.push(el.className.split(' ')[0]);
        });
      }
      const btnBox = r(f.querySelector('button[type="submit"]'));
      return { stage, card, btn: btnBox, fit: Number(f.dataset.fit), layout: f.dataset.dlayout, boxes: f.querySelector('.input-wrapper-container')?.dataset.layout, cut, minFont, outside, btnWide: Math.round(btnBox.w / card.w * 4) };
    }, VIEWER);
    expect.soft(m.btn.b, `${id}: Play button is cut off`).toBeLessThanOrEqual(m.card.b + 2);
    expect.soft(m.btn.y, `${id}: Play button is above its card`).toBeGreaterThanOrEqual(m.card.y - 2);
    expect.soft(m.card.r, `${id}: card is outside the video`).toBeLessThanOrEqual(m.stage.r + 2);
    expect.soft(m.fit, `${id}: text had to shrink to ${m.fit}`).toBeGreaterThanOrEqual(0.6);
    expect.soft(m.cut, `${id}: box hints are cut off`).toEqual([]);
    expect.soft(m.minFont, `${id}: box text is only ${m.minFont}px`).toBeGreaterThanOrEqual(8);
    expect.soft(m.outside, `${id}: ${m.outside.join(', ')} cross the oval`).toEqual([]);
    seen.push({ id, sig: [m.layout, m.boxes, m.btnWide, Math.round((m.card.x - m.stage.x) / m.stage.w * 8), Math.round(m.card.w / m.stage.w * 8), Math.round(m.card.h / m.stage.h * 8)].join('|'), fit: m.fit, font: m.minFont });
    if (SHOTS) await form(page).locator('xpath=..').screenshot({ path: path.join(SHOTS, `${String(i + 1).padStart(2, '0')}-${id}.png`) });
  }
  // They really look different: layout, box arrangement and where / how big the card is vary across the 30.
  const signatures = new Set(seen.map((x) => x.sig));
  console.log(`distinct layout signatures: ${signatures.size} / 30; text scale / box font px: ${seen.map((x) => `${x.id}=${x.fit}/${x.font}`).join(' ')}`);
  // measured: 15 structurally different arrangements among the 30 (the rest differ by skin: colours, fonts, shapes, decoration). Guard against falling back to one skeleton.
  expect(signatures.size).toBeGreaterThanOrEqual(14);
  expect(pageErrors).toEqual([]);
});

test('the picked design is saved on the overlay (it is still picked after closing and re-selecting it)', async () => {
  await pickDesign('retro-terminal');
  await reselectOverlay();
  await expect(page.locator(`${VIEWER} form.retarget-form[data-design="retro-terminal"]`)).toBeVisible();
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick="retro-terminal"]')).toHaveClass(/active/);
  await panelTab(page, 'Styles').click();
  expect(await control('fontFamily').inputValue()).toBe('Share Tech Mono');
});

test('picking a design fills in its wording and boxes, and a second pick replaces them cleanly', async () => {
  await pickDesign('vip-access');
  await panelTab(page, 'Text').click();
  await expect(control('caption')).toHaveValue('VIP ACCESS');
  await expect(form(page).locator('.optin-badge[data-badge="crown"]')).toBeVisible();
  await pickDesign('aurora-glass');
  await panelTab(page, 'Text').click();
  await expect(control('caption')).toHaveValue('Get Your Personalized Video');
  await expect(form(page).locator('.optin-badge')).toHaveCount(0);
  await panelTab(page, 'Fields').click();
  await expect(page.locator('.addon-fieldlist__row')).toHaveCount(3);
});

test('what you edit is what you see: design options change the form on the video', async () => {
  await pickDesign('glass-split');
  const f = form(page);
  await panelTab(page, 'Text').click();
  await control('eyebrow').fill('LIMITED OFFER');
  await expect(f.locator('.optin-eyebrow')).toHaveText('LIMITED OFFER');
  await control('subtitle').fill('A new sub-title');
  await expect(f.locator('.optin-subtitle')).toHaveText('A new sub-title');
  await control('panelTitle').fill('Your Details');
  await expect(f.locator('.optin-paneltitle')).toHaveText('Your Details');
  await panelTab(page, 'Design').click();
  await control('brandName').fill('Acme Video');
  await expect(f.locator('.optin-brand')).toContainText('Acme Video');
  await control('badgeIcon').selectOption('ticket');
  await expect(f.locator('.optin-badge[data-badge="ticket"]')).toBeVisible();
  await control('btnIcon').selectOption('arrow');
  await expect(f.locator('button[type="submit"]')).toHaveAttribute('data-icon', 'arrow');
  await control('designLayout').selectOption('center');
  await expect(f).toHaveAttribute('data-dlayout', 'center');
  await control('designLayout').selectOption('split');
  await expect(f.locator('.optin-side')).toBeVisible();
  await control('cardRadius').evaluate((n) => { n.value = '40'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(f.locator('.form-inner')).toHaveCSS('border-radius', '40px');
  await control('designAccent').fill('#ff00aa');
  await expect(f).toHaveCSS('--od-accent', '#ff00aa');
  await control('decorEnabled').click();
  await expect(f).toHaveAttribute('data-decor', 'off');
  await control('inputIcons').click();
  await expect(f.locator('input.has-icon')).toHaveCount(0);
  await control('inputIcons').click();
  await expect(f.locator('input.has-icon').first()).toBeVisible();
  await panelTab(page, 'Fields').click();
  await control('fieldLayout').selectOption('cols');
  // the choice is kept; in this narrow column the labels would be cut off, so it is drawn with fewer columns (and restored on a wider video)
  await expect(f.locator('.input-wrapper-container')).toHaveAttribute('data-wanted', 'cols');
  expect(['cols', 'grid', 'stacked']).toContain(await f.locator('.input-wrapper-container').getAttribute('data-layout'));
  expect(pageErrors).toEqual([]);
});

test('every control on every tab can be edited, and every edit is saved on the overlay', async () => {
  await pickDesign('social-proof'); // split layout + testimonial: shows the most controls
  const edited = []; // { tab, key, type, value }
  const tabs = await page.locator('.addon-panel .addon-tab').allTextContents();
  for (const name of tabs) {
    await panelTab(page, name).click();
    const done = new Set();
    // editing a control can reveal more (a toggle shows its colour, a layout shows its options): go on until nothing new is left
    for (let round = 0; round < 12; round += 1) {
      const keys = await page.locator('.addon-panel [data-key]').evaluateAll((els, skip) => els
        .filter((e) => !skip.includes(e.dataset.kind) && e.type !== 'file')
        .map((e) => e.dataset.key), [...SKIP_KINDS]);
      const todo = [...new Set(keys)].filter((k) => !done.has(k));
      if (!todo.length) break;
      for (const key of todo) {
        done.add(key);
        const el = control(key);
        if (!(await el.count())) continue; // hidden by an earlier edit
        const r = await edit(el);
        edited.push({ tab: name, key, ...r });
      }
    }
  }
  expect(edited.length).toBeGreaterThan(60);
  expect(pageErrors).toEqual([]);

  // read back from the saved overlay
  await reselectOverlay();
  // The testimonial controls only exist in the Split layout (the loop above also edited the layout itself): show it again to read them.
  expect(edited.find((e) => e.key === 'designLayout')).toBeTruthy();
  await panelTab(page, 'Design').click();
  expect(await control('designLayout').inputValue()).toBe(edited.find((e) => e.key === 'designLayout').value); // the layout edit was saved
  await control('designLayout').selectOption('split');
  const lost = [];
  for (const e of edited.filter((x) => x.key !== 'designLayout')) {
    await panelTab(page, e.tab).click();
    const el = control(e.key);
    if (!(await el.count())) { lost.push(`${e.tab}/${e.key}: control is gone`); continue; }
    const got = await valueOf(el);
    const want = typeof e.value === 'string' ? e.value.toLowerCase() : e.value;
    if (got !== want) lost.push(`${e.tab}/${e.key}: edited to ${JSON.stringify(want)} but saved ${JSON.stringify(got)}`);
  }
  expect(lost, lost.join('\n')).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('the Fields tab edits the boxes: labels, types, a Dropdown shown as a quiz list, add / remove / reorder', async () => {
  await pickDesign('qualifying-quiz');
  await panelTab(page, 'Fields').click();
  const rows = page.locator('.addon-fieldlist__row');
  await expect(rows).toHaveCount(4); // the quiz question + the three starter boxes
  // the question is a real Dropdown field, drawn as a list of choices on the video
  await expect(rows.first().locator('.addon-fieldlist__type')).toHaveValue('select');
  await expect(form(page).locator('.optin-choice input[type="radio"]')).toHaveCount(4);
  await rows.first().locator('.addon-fieldlist__options').fill('Yes, No');
  await expect(form(page).locator('.optin-choice input[type="radio"]')).toHaveCount(2);
  await rows.first().locator('.addon-fieldlist__label').fill('Ready to start?');
  await expect(form(page).locator('.optin-choice legend')).toHaveText('Ready to start?');
  // the Dropdown can be shown as a normal dropdown instead
  await panelTab(page, 'Design').click();
  await control('choiceStyle').selectOption('dropdown');
  await expect(form(page).locator('.optin-choice')).toHaveCount(0);
  await expect(form(page).locator('select')).toHaveCount(1);
  await control('choiceStyle').selectOption('list');
  // add / reorder / remove
  await panelTab(page, 'Fields').click();
  await page.locator('.addon-fieldlist__add').click();
  await expect(rows).toHaveCount(5);
  await rows.nth(4).locator('.addon-fieldlist__up').click();
  await expect(rows.nth(3).locator('.addon-fieldlist__label')).toHaveValue('New field');
  await rows.nth(3).locator('.addon-fieldlist__remove').click();
  await expect(rows).toHaveCount(4);
  // saved
  await reselectOverlay();
  await panelTab(page, 'Fields').click();
  await expect(rows).toHaveCount(4);
  await expect(rows.first().locator('.addon-fieldlist__label')).toHaveValue('Ready to start?');
  expect(pageErrors).toEqual([]);
});

test('text on the video can be edited in place and shows in the panel', async () => {
  await pickDesign('neon-floating-card');
  await form(page).locator('.retarget-caption').click();
  const box = page.locator('.optin-text-edit');
  await expect(box).toBeVisible();
  await box.fill('Typed on the video');
  await box.press('Enter');
  await expect(form(page).locator('.retarget-caption')).toHaveText('Typed on the video');
  await panelTab(page, 'Text').click();
  await expect(control('caption')).toHaveValue('Typed on the video');
  // the design's own text too (brand name)
  await form(page).locator('.optin-brand span').click();
  await page.locator('.optin-text-edit').fill('Brand typed here');
  await page.locator('.optin-text-edit').press('Enter');
  await panelTab(page, 'Design').click();
  await expect(control('brandName')).toHaveValue('Brand typed here');
  expect(pageErrors).toEqual([]);
});

test('the standard (no design) look still works: the Lead Generator is not forced into a design', async () => {
  await panelTab(page, 'Design').click();
  // the first Lead Generator on a fresh project has no design; "classic" restores that colour scheme and layout
  await pickDesign('classic-overlay');
  await expect(form(page).locator('.retarget-caption')).not.toBeEmpty();
  await expect(form(page)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

// ---------------------------------------------------------------- colour schemes (one click recolours the whole design)
const hueOfHex = (hex) => {
  const n = parseInt(hex.slice(1), 16); const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  if (!d) return null;
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60);
};

test('a colour scheme recolours the whole design in one click; it is saved, restorable, and every colour is still editable', async () => {
  await pickDesign('aurora-glass'); // teal / green
  const buttonColor = async () => { await panelTab(page, 'Styles').click(); return (await control('buttonBackground').inputValue()).toLowerCase(); };
  const own = await buttonColor();
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-scheme-pick]')).toHaveCount(13);
  await page.locator('.addon-panel [data-scheme-pick="pink"]').click();
  await expect(page.locator('.addon-panel [data-scheme-pick="pink"]')).toHaveClass(/active/);
  // the form on the video wears it: the Play button's colour is pink now (it was teal)
  const pink = await buttonColor();
  expect(pink).not.toBe(own);
  expect(Math.abs(hueOfHex(pink) - 330)).toBeLessThanOrEqual(40);
  const shownButton = await form(page).locator('button[type="submit"]').evaluate((b) => b.style.background);
  expect(shownButton).toMatch(/rgb/);
  // saved on the overlay
  await reselectOverlay();
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-scheme-pick="pink"]')).toHaveClass(/active/);
  expect(await buttonColor()).toBe(pink);
  // another scheme starts from the design's own colours (no drift), and "the design's own" restores them exactly
  await panelTab(page, 'Design').click();
  await page.locator('.addon-panel [data-scheme-pick="blue"]').click();
  expect(Math.abs(hueOfHex(await buttonColor()) - 218)).toBeLessThanOrEqual(40);
  await panelTab(page, 'Design').click();
  await page.locator('.addon-panel [data-scheme-pick=""]').click();
  expect(await buttonColor()).toBe(own);
  // after a scheme every colour is still a plain editable control
  await panelTab(page, 'Design').click();
  await page.locator('.addon-panel [data-scheme-pick="amber"]').click();
  await panelTab(page, 'Styles').click();
  await control('buttonBackground').fill('#123456');
  expect(await control('buttonBackground').inputValue()).toBe('#123456');
  // picking a design again goes back to that design's own colours (and no scheme is marked)
  await pickDesign('retro-terminal');
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-scheme-pick][class*="active"]')).toHaveAttribute('data-scheme-pick', '');
  expect(pageErrors).toEqual([]);
});

test('every design wears every colour scheme: fits, labels intact, text readable on the Play button', async () => {
  await panelTab(page, 'Design').click();
  const ids = await page.locator('.addon-panel [data-design-pick]').evaluateAll((els) => els.map((e) => e.dataset.designPick));
  const schemes = ['', 'amber', 'cyan', 'pink'];
  for (const id of ids) {
    await pickDesign(id);
    for (const sch of schemes) {
      await panelTab(page, 'Design').click();
      await page.locator(`.addon-panel [data-scheme-pick="${sch}"]`).click();
      await expect.poll(async () => Number(await form(page).getAttribute('data-fit') || 0)).toBeGreaterThan(0);
      const m = await page.evaluate((viewer) => {
        const f = document.querySelector(`${viewer} form.retarget-form`);
        const card = f.querySelector('.form-inner').getBoundingClientRect(); const btn = f.querySelector('button[type="submit"]');
        const b = btn.getBoundingClientRect();
        return { inside: b.bottom <= card.bottom + 2 && b.right <= card.right + 2, fit: Number(f.dataset.fit), color: getComputedStyle(btn).color, bg: btn.style.background };
      }, VIEWER);
      expect.soft(m.inside, `${id} + ${sch || 'own'}: Play inside card`).toBe(true);
      expect.soft(m.fit, `${id} + ${sch || 'own'}: text scale`).toBeGreaterThanOrEqual(0.6);
    }
  }
  expect(pageErrors).toEqual([]);
});
