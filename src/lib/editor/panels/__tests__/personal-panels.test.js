import { describe, it, expect, vi } from 'vitest';
import { contactValues, renderPersonalizationPanel, renderPersonalizationEditor, renderTokenEditor, renderBatchHub } from '../personalPanels.js';
import { resolveOverlayText } from '../../addons/overlayRender.js';

// As the Personalize window stores it, including Find a Business details.
const ann = { id: 'c-ann', contact: { name: 'Ann Lee', firstName: 'Ann', company: 'Acme' }, variables: { firstName: 'Ann' }, personalization: { business: { businessName: 'Acme Plumbing', phone: '555 0100' } } };
const raj = { id: 'c-raj', contact: { name: 'Raj Patel', firstName: 'Raj' }, variables: { firstName: 'Raj' } };
const el = () => { const e = document.createElement('div'); document.body.appendChild(e); return e; };

describe('rail panels for personalization', () => {
  it('shows the details the studio has for a contact, including business details', () => {
    const keys = contactValues(ann).map((v) => v.key);
    expect(keys).toEqual(expect.arrayContaining(['firstName', 'businessName']));
    expect(contactValues(null)).toEqual([]);
  });

  it('Personalization: lists values, adds one as text, switches contact, opens Personalize', () => {
    const e = el();
    const s = { contacts: () => [ann, raj], active: () => ann, select: vi.fn(), addText: vi.fn(), openPersonalize: vi.fn() };
    renderPersonalizationPanel(e, s);
    expect(e.textContent).toContain('Acme Plumbing');
    e.querySelector('[data-add="firstName"]').click();
    expect(s.addText).toHaveBeenCalledWith('{{firstName}}');
    const sel = e.querySelector('[data-rp="contact"]');
    sel.value = 'c-raj';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(s.select).toHaveBeenCalledWith('c-raj');
    e.querySelector('[data-rp="open"]').click();
    expect(s.openPersonalize).toHaveBeenCalled();
  });

  it('Personalization Editor: live preview for the contact, warns about missing values, adds Smart Text', () => {
    const e = el();
    const s = { active: () => raj, tokens: [['firstName', 'First Name'], ['businessName', 'Business']], resolve: resolveOverlayText, addText: vi.fn() };
    renderPersonalizationEditor(e, s);
    const ta = e.querySelector('[data-rp="text"]');
    ta.value = 'Hi {{firstName}} at {{businessName}}';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(e.querySelector('[data-rp="preview"]').textContent).toContain('Hi Raj at');
    expect(e.querySelector('[data-rp="missing"]').textContent).toContain('{{businessName}}');
    e.querySelector('[data-rp="add"]').click();
    expect(s.addText).toHaveBeenCalledWith('Hi {{firstName}} at {{businessName}}');
  });

  it('Token Editor: tokens insert as text and scenes are built for the selected contact', async () => {
    const e = el();
    const s = { active: () => ann, insert: vi.fn(), autoTimeline: vi.fn(async () => 3) };
    renderTokenEditor(e, s);
    e.querySelector('[data-key="company"]').click();
    expect(s.insert).toHaveBeenCalledWith('{{company}}');
    e.querySelector('[data-rp="auto"]').click();
    await vi.waitFor(() => expect(e.querySelector('[data-rp="status"]').textContent).toMatch(/Added 3 scenes/));
  });

  it('Personalized output: pick contacts, then download MP4s or create links for exactly those', async () => {
    const e = el();
    const s = {
      contacts: () => [ann, raj], tokensUsed: () => ['firstName'], issues: (p) => (p.id === 'c-raj' ? ['no logo'] : []),
      exportSelected: vi.fn(), createLinks: vi.fn(async (ids) => ({ rows: ids.map((id) => ({ name: id, link: `https://app.test/watch/v?p=${id}`, note: '' })), notice: '1 new, 0 refreshed.' })),
      copy: vi.fn(async () => {}), downloadCsv: vi.fn(), openShare: vi.fn(),
    };
    renderBatchHub(e, s);
    expect(e.textContent).toMatch(/1 of 2 contacts ready/i);
    expect(e.textContent).toContain('no logo');
    expect(e.querySelector('[data-rp="export"]').textContent).toContain('Download MP4s (2)');
    // untick one contact: the counts and what the buttons act on follow
    e.querySelector('[data-pick="c-raj"]').click();
    expect(e.querySelector('[data-rp="export"]').textContent).toContain('Download MP4s (1)');
    e.querySelector('[data-rp="export"]').click();
    expect(s.exportSelected).toHaveBeenCalledWith([String(ann.id)]);
    e.querySelector('[data-rp="links"]').click();
    await vi.waitFor(() => expect(e.textContent).toContain('1 link ready'));
    expect(s.createLinks).toHaveBeenCalledWith([String(ann.id)]);
    e.querySelector('[data-rp="copy"]').click();
    await vi.waitFor(() => expect(s.copy).toHaveBeenCalledWith(`https://app.test/watch/v?p=${ann.id}`));
    e.querySelector('[data-rp="csv"]').click();
    expect(s.downloadCsv).toHaveBeenCalled();
  });

  it('Personalized output: "Ready only" ticks just the ready contacts; "Links + MP4s" starts the export only after the links work', async () => {
    const e = el();
    const createLinks = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Publish the video first'), { code: 'not_published' }))
      .mockResolvedValueOnce({ rows: [{ name: 'Ann', link: 'https://x/y', note: '' }] });
    const s = { contacts: () => [ann, raj], tokensUsed: () => ['firstName', 'businessName'], exportSelected: vi.fn(), createLinks, openShare: vi.fn() };
    renderBatchHub(e, s);
    e.querySelector('[data-rp="readyonly"]').click();
    expect(e.querySelector('[data-rp="count"]').textContent).toContain('1 selected');
    e.querySelector('[data-rp="both"]').click();
    await vi.waitFor(() => expect(e.textContent).toContain('Publish the video first'));
    expect(s.exportSelected).not.toHaveBeenCalled(); // links failed: no MP4s started
    expect(e.querySelector('[data-rp="share"]')).not.toBeNull();
    e.querySelector('[data-rp="both"]').click();
    await vi.waitFor(() => expect(s.exportSelected).toHaveBeenCalledWith([String(ann.id)]));
  });

  it('Personalized output: with nobody selected nothing can be started', () => {
    const e = el();
    renderBatchHub(e, { contacts: () => [ann, raj], tokensUsed: () => [], exportSelected: vi.fn(), createLinks: vi.fn(), openShare: vi.fn() });
    e.querySelector('[data-rp="none"]').click();
    expect(e.querySelector('[data-rp="export"]').disabled).toBe(true);
    expect(e.querySelector('[data-rp="links"]').disabled).toBe(true);
  });

  it('Batch Generator: readiness per contact, then export one video each or open Share', () => {
    const e = el();
    const s = { contacts: () => [ann, raj], tokensUsed: () => ['firstName', 'businessName'], exportEach: vi.fn(), openShare: vi.fn() };
    renderBatchHub(e, s);
    expect(e.textContent).toMatch(/1 of 2 contacts ready/i);
    expect(e.textContent).toContain('missing businessName');
    e.querySelector('[data-rp="export"]').click();
    e.querySelector('[data-rp="share"]').click();
    expect(s.exportEach).toHaveBeenCalled();
    expect(s.openShare).toHaveBeenCalled();
  });
});
