// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { contactLabel, leadTableRows, deliveryCard } from '../../../components/landingPages/leadsPanel.js';
import { contactRows } from '../../../components/landingPages/heatPanel.js';

const contacts = [{ id: 'c1', fields: { firstname: 'Dana', lastname: 'Whitfield' } }, { id: 'c2', fields: { company: 'Acme' } }, { id: 'c3', fields: {} }];
const byId = new Map(contacts.map((c) => [c.id, c]));

describe('leads and heat panels', () => {
  it('names the contact behind each lead, or says it was a direct visit', () => {
    expect(contactLabel('c1', byId)).toBe('Dana Whitfield');
    expect(contactLabel('c2', byId)).toBe('Acme');
    expect(contactLabel('c3', byId)).toBe('Link c3');
    expect(contactLabel(null, byId)).toBe('Direct visit');
    const rows = leadTableRows([{ id: 1, createdAt: 't', kind: 'list-builder', source: { contactId: 'c1', page: 'https://x/p/abc' }, data: { EMAIL: 'd@x.co' } }, { id: 2, createdAt: 't2', source: {}, data: { EMAIL: 'z@x.co' } }], byId);
    expect(rows.map((r) => r.who)).toEqual(['Dana Whitfield', 'Direct visit']);
    expect(rows[0].answers).toEqual({ EMAIL: 'd@x.co' });
  });
  it('joins heat, event counts and leads into one row per personal link', () => {
    const rows = contactRows({
      heat: [{ contactId: 'c1', sessions: 2, clicks: 3, maxScroll: 80, watchedSeconds: 41, lastSeen: '2026-11-17T10:00:00Z' }],
      stats: [{ contactId: 'c1', views: 2, plays: 1, completes: 1, leads: 1, lastSeen: '2026-11-17T09:00:00Z' }, { contactId: 'c2', views: 1, plays: 0, completes: 0, leads: 0, lastSeen: '2026-11-18T09:00:00Z' }],
      contacts,
    });
    expect(rows.map((r) => r.contactId)).toEqual(['c2', 'c1']); // newest first
    expect(rows.find((r) => r.contactId === 'c1')).toMatchObject({ who: 'Dana Whitfield', views: 2, plays: 1, watchedSeconds: 41, maxScroll: 80, clicks: 3, completed: 1, leads: 1 });
    expect(rows.find((r) => r.contactId === 'c2')).toMatchObject({ watchedSeconds: 0, maxScroll: 0, leads: 0 });
  });
  it('the delivery card loads, edits and saves only sanitized settings', async () => {
    let saved = null;
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings: { webhookEnabled: true, webhook: 'https://hooks.example.com/h' } }, error: null }) }) }),
        upsert: async (row) => { saved = row; return { error: null }; },
      }),
    };
    const toast = vi.fn();
    const card = deliveryCard({ page: { id: 'page1234' }, client, toast });
    document.body.appendChild(card);
    await new Promise((r) => setTimeout(r, 10));
    const hook = card.querySelector('input[data-key="webhook"]'); expect(hook.value).toBe('https://hooks.example.com/h');
    const mail = card.querySelector('input[data-key="emailAddress"]'); mail.value = 'me@example.com'; mail.dispatchEvent(new Event('input', { bubbles: true }));
    const bad = card.querySelector('input[data-key="webhook2"]'); bad.value = 'http://insecure.example.com'; bad.dispatchEvent(new Event('input', { bubbles: true }));
    [...card.querySelectorAll('button')].find((b) => b.textContent === 'Save').click();
    await new Promise((r) => setTimeout(r, 10));
    expect(saved.page_id).toBe('page1234');
    expect(saved.settings).toMatchObject({ webhook: 'https://hooks.example.com/h', webhook2: '', emailAddress: 'me@example.com' });
    expect(toast).toHaveBeenCalled();
  });
});
