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
