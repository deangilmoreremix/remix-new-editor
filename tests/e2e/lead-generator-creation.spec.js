// Creating a Lead Generator / List Builder WITH a design, through the editor's existing creation paths:
//   Elements tab (Lead Generator / List Builder -> "Start from a design") and the "Add to timeline" window.
// The existing rules still hold: a List Builder is a gate at the start and one per video; a Lead Generator can be added several times.
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

const VIEWER = '[data-testid="viewer-stage"]';
const lane = (page) => page.locator('[data-testid="overlay-lane"] [role="button"]');
const panelTab = (page, name) => page.locator('.addon-panel .addon-tab', { hasText: new RegExp(`^${name}$`) });
const control = (page, key) => page.locator(`.addon-panel [data-key="${key}"]:not([data-kind="hex"])`).first();
const dialog = (page) => page.getByRole('dialog', { name: 'Add to timeline' });

let page;
const pageErrors = [];

async function elementsKind(label) {
  await page.getByRole('button', { name: 'ELEMENTS' }).click();
  await page.getByRole('button', { name: label, exact: true }).first().click();
  await expect(page.locator('[data-testid="form-designs"]')).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 300)));
  await page.goto('/#/timeline', { waitUntil: 'domcontentloaded' });
  await page.getByText('Skip for now').click({ timeout: 150_000 });
  await page.getByRole('button', { name: 'New Project' }).first().click();
  await page.getByPlaceholder('Project name...').fill('Creation with designs');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'ELEMENTS' }).waitFor({ timeout: 60_000 });
});
test.afterAll(async () => { await page?.context().close(); });

test('Elements > Lead Generator shows a gallery of every design, each a real preview of itself', async () => {
  await elementsKind('Lead Generator');
  const cards = page.locator('[data-testid^="design-card-"]');
  await expect(cards).toHaveCount(30);
  await expect(page.locator('[data-testid="form-designs"] .optin-mini')).toHaveCount(30);
  const pairs = await cards.evaluateAll((els) => els.map((c) => [c.dataset.testid.replace('design-card-', ''), c.querySelector('form')?.dataset.design]));
  pairs.forEach(([card, shown]) => expect(shown).toBe(card));
  // the plain card is still there
  await expect(page.locator('button.element-card', { hasText: 'Click to add it as an overlay' })).toBeVisible();
});

test('clicking a design creates a Lead Generator with that design and opens it', async () => {
  await page.locator('[data-testid="design-card-glass-split"]').click();
  await page.locator('.addon-panel').waitFor({ timeout: 60_000 });
  await expect(lane(page)).toHaveCount(1);
  await expect(page.locator(`${VIEWER} form.retarget-form[data-design="glass-split"]`)).toBeVisible();
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick="glass-split"]')).toHaveClass(/active/);
  await panelTab(page, 'Text').click();
  await expect(control(page, 'caption')).toHaveValue('Glass Split Demo'); // the design's own wording
  await panelTab(page, 'Fields').click();
  await expect(page.locator('.addon-fieldlist__row')).toHaveCount(3); // and its three starter boxes
  // it is the existing Lead Generator in every other way: the same tabs and settings
  await expect(page.locator('.addon-panel .addon-tab')).toHaveText(['Text', 'Design', 'Styles', 'Fields', 'Pointer', 'Integrations']);
});

test('a Lead Generator can be added again with another design (they are not one-per-video)', async () => {
  await elementsKind('Lead Generator');
  await page.locator('[data-testid="design-card-vip-access"]').click();
  await page.locator('.addon-panel').waitFor();
  await expect(lane(page)).toHaveCount(2);
  await expect(page.locator(`${VIEWER} form.retarget-form[data-design="vip-access"]`)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Elements > List Builder: a design creates the List Builder as the start-of-video gate; a second design is applied to it (still one)', async () => {
  await elementsKind('List Builder');
  await expect(page.locator('[data-testid^="design-card-"]')).toHaveCount(30);
  await page.locator('[data-testid="design-card-aurora-glass"]').click();
  await page.locator('.addon-panel').waitFor();
  await expect(page.getByText('LIST BUILDER OVERLAY', { exact: false }).first()).toBeVisible();
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick="aurora-glass"]')).toHaveClass(/active/);
  const listBuilders = () => lane(page).filter({ hasText: 'List Builder' });
  await expect(listBuilders()).toHaveCount(1);
  // another design: the existing List Builder takes it
  await elementsKind('List Builder');
  await page.locator('[data-testid="design-card-retro-terminal"]').click();
  await page.locator('.addon-panel').waitFor();
  await expect(listBuilders()).toHaveCount(1);
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick="retro-terminal"]')).toHaveClass(/active/);
  await expect(page.locator('.addon-panel [data-design-pick="aurora-glass"]')).not.toHaveClass(/active/);
  expect(pageErrors).toEqual([]);
});

test('the List Builder has the same Design tab: all designs, every control editable and saved, and the kind switch keeps the design', async () => {
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick]')).toHaveCount(30);
  await page.locator('.addon-panel [data-design-pick="glass-split"]').click();
  await expect(page.locator('.addon-panel [data-design-pick="glass-split"]')).toHaveClass(/active/);
  // edit a few kinds of control
  await control(page, 'brandName').fill('Acme Lists');
  await control(page, 'btnIcon').selectOption('arrow');
  await control(page, 'cardRadius').evaluate((n) => { n.value = '33'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  await control(page, 'decorEnabled').click();
  // saved on the overlay: close and open it again from the lane
  await page.getByRole('button', { name: 'Close' }).first().click();
  await lane(page).filter({ hasText: 'List Builder' }).first().click();
  await page.locator('.addon-panel').waitFor();
  await panelTab(page, 'Design').click();
  await expect(control(page, 'brandName')).toHaveValue('Acme Lists');
  await expect(control(page, 'btnIcon')).toHaveValue('arrow');
  await expect(control(page, 'cardRadius')).toHaveValue('33');
  await expect(control(page, 'decorEnabled')).not.toBeChecked();
  // switch List Builder -> Personalizer: its own wording switches, the design stays
  await panelTab(page, 'Styles').click();
  await control(page, 'kind').selectOption('personalizer');
  await expect(page.getByText('PERSONALIZER', { exact: false }).first()).toBeVisible();
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick="glass-split"]')).toHaveClass(/active/);
  await expect(control(page, 'brandName')).toHaveValue('Acme Lists');
  expect(pageErrors).toEqual([]);
});

test('Add to timeline: a card per design for both kinds, found by search, created through the same logic', async () => {
  await page.getByRole('button', { name: 'EDIT', exact: true }).click();
  await page.getByRole('button', { name: 'Add to timeline', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  const search = dialog(page).getByRole('textbox', { name: 'Search', exact: true });
  await search.fill('Ticket Invitation');
  await expect(page.getByTestId('design-lead-form-ticket-invitation')).toBeVisible();
  await expect(page.getByTestId('design-list-builder-ticket-invitation')).toBeVisible();
  // a Lead Generator with the design is added (a third one)
  const before = await lane(page).count();
  await page.getByTestId('design-lead-form-ticket-invitation').click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(lane(page)).toHaveCount(before + 1);
  await expect(page.locator(`${VIEWER} form.retarget-form[data-design="ticket-invitation"]`)).toBeVisible();
  // the List Builder card applies the design to the existing List Builder, without adding another
  await page.getByRole('button', { name: 'Add to timeline', exact: true }).click();
  await dialog(page).getByRole('textbox', { name: 'Search', exact: true }).fill('Ticket Invitation');
  await page.getByTestId('design-list-builder-ticket-invitation').click();
  await expect(lane(page).filter({ hasText: 'List Builder' })).toHaveCount(1);
  await expect(lane(page)).toHaveCount(before + 1);
  await panelTab(page, 'Design').click();
  await expect(page.locator('.addon-panel [data-design-pick="ticket-invitation"]')).toHaveClass(/active/);
  expect(pageErrors).toEqual([]);
});
