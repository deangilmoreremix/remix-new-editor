// The Timeline Studio Editor's Publish tab shows only the personal links of the published video (linksOnly).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../addons/index.js';
import { renderSharePanel } from '../sharePanel.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const ID = 'L'.repeat(20);
const link = (o) => ({ id: ID, contactId: 'c-ann', name: 'Ann Lee', variables: { firstName: 'Ann' }, overrides: {}, revoked: false, ...o });
let host;
beforeEach(() => { document.body.innerHTML = ''; host = document.createElement('div'); document.body.appendChild(host); });

function mount(extra = {}, links = [link()]) {
  const lk = { list: vi.fn(async () => links), sync: vi.fn(async () => ({ links, created: 1, updated: 0 })), update: vi.fn(async (id, patch) => ({ ...links[0], ...patch })), regenerate: vi.fn(async () => ({})), remove: vi.fn(async () => {}), tokens: () => ['firstName'], label: (k) => k, contact: () => ({}) };
  renderSharePanel(host, { linksOnly: true, getInfo: async () => ({ id: 'abcdefgh12', title: 'Demo', published: true, view_count: 3 }), copy: vi.fn(async () => {}), downloadCsv: vi.fn(), links: lk, ...extra });
  return lk;
}

describe('links-only share panel', () => {
  it('draws just the personal links: no title, publish button, embed code, stats or readable-name form', async () => {
    mount({ publish: vi.fn(), saveLink: vi.fn(), setPrivacy: vi.fn(), fetchStats: vi.fn(async () => []), listRevisions: vi.fn(async () => []), guest: () => true });
    await tick(); await tick();
    expect(host.querySelector('[data-testid="personal-links-panel"]')).not.toBeNull();
    expect(host.textContent).toContain('Ann Lee');
    for (const sel of ['[data-share-title]', '[data-share-publish]', '[data-share-embed]', '[data-share-slug]', '[data-share-privacy]', '.share-stats', '.share-guest']) expect(host.querySelector(sel)).toBeNull();
  });

  it('keeps every way to change a link: edit, new address, turn off, remove, copy, CSV', async () => {
    const copy = vi.fn(async () => {}); const downloadCsv = vi.fn();
    const lk = mount({ copy, downloadCsv });
    await tick(); await tick();
    host.querySelector('[data-link-copy]').click(); await tick();
    expect(copy).toHaveBeenCalledWith(`${globalThis.location.origin}/watch/abcdefgh12?p=${ID}`);
    host.querySelector('[data-link-edit]').click();
    host.querySelector('[data-link-field="firstName"]').value = 'Annie';
    host.querySelector('[data-link-save]').click(); await tick(); await tick();
    expect(lk.update).toHaveBeenCalledWith(ID, { overrides: { firstName: 'Annie' } });
    host.querySelector('[data-link-revoke]').click(); await tick(); await tick();
    expect(lk.update).toHaveBeenCalledWith(ID, { revoked: true });
    host.querySelector('[data-link-new]').click(); host.querySelector('[data-link-new]').click(); await tick(); await tick();
    expect(lk.regenerate).toHaveBeenCalledWith(ID);
    host.querySelector('[data-link-remove]').click(); host.querySelector('[data-link-remove]').click(); await tick(); await tick();
    expect(lk.remove).toHaveBeenCalledWith(ID);
  });

  it('asks the owner to publish first when the video is not published', async () => {
    mount({ getInfo: async () => null });
    await tick(); await tick();
    expect(host.textContent).toContain('Publish the video to create personal links');
    expect(host.querySelector('[data-link-edit]')).toBeNull();
  });
});
