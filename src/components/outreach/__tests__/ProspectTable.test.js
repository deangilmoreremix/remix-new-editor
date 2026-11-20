// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderProspectTable, prospectStatus, filterCounts, filterLinks, initials, watchedPct } from '../ProspectTable.js';

const links = [
  { contactId: 'm', name: 'Maya Chen', email: 'maya@brightline.example', link: 'https://x/p/1?c=m', thumbnailUrl: 'https://cdn.x/m.gif', heard: 'Hi Maya!' },
  { contactId: 's', name: 'Sam Ortiz', email: 'sam@harborpine.example', link: 'https://x/p/1?c=s', sentAt: '2026-11-20T10:00:00Z' },
  { contactId: 'p', name: 'Priya Nair', email: 'priya@lumen.example', link: 'https://x/p/1?c=p' },
  { contactId: 'a', name: 'Alex Morgan', email: 'alex@fieldstone.example', link: '' },
];
const contacts = [
  { id: 'm', company: 'Brightline Logistics', website: 'https://brightline.example/home' },
  { id: 's', company: 'Harbor & Pine', website: 'harborpine.example' },
  { id: 'p', company: 'Lumen Health' }, { id: 'a', company: 'Fieldstone Capital' },
];
const stats = { m: { views: 2, plays: 1, completes: 0, ctaClicks: 1, progress: 92 }, s: { views: 1, plays: 0, completes: 0, ctaClicks: 0, progress: 0 } };

describe('prospect table', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('works out each prospect’s status and the filter counts', () => {
    expect(links.map((l) => prospectStatus(l, stats[l.contactId]))).toEqual(['watched', 'sent', 'generated', 'generating']);
    expect(filterCounts(links, stats)).toEqual({ all: 4, generated: 3, sent: 2, watched: 1 });
    expect(filterLinks(links, stats, 'sent').map((l) => l.contactId)).toEqual(['m', 's']);
    expect(filterLinks(links, stats, 'watched').map((l) => l.contactId)).toEqual(['m']);
    expect(initials('Maya Chen')).toBe('MC');
    expect(watchedPct({ progress: 40, completes: 1 })).toBe(100);
  });

  it('shows thumbnail, initials, name, email, company, website, status and watched %', () => {
    const share = vi.fn();
    const sentAction = vi.fn();
    document.body.appendChild(renderProspectTable({ links, contacts, stats, total: 4, share, menu: () => [{ label: 'Gmail', attr: 'data-outreach-gmail', href: 'https://mail.google.com/x', onClick: sentAction }] }));
    expect(document.querySelector('[data-prospects-generated]').textContent).toBe('3 of 4 generated');
    const rows = [...document.querySelectorAll('[data-outreach-link-row]')];
    expect(rows.map((r) => r.dataset.status)).toEqual(['watched', 'sent', 'generated', 'generating']);
    const maya = rows[0];
    expect(maya.querySelector('[data-outreach-row-thumb] img').src).toBe('https://cdn.x/m.gif');
    expect(maya.textContent).toContain('MC');
    expect(maya.textContent).toContain('maya@brightline.example');
    expect(maya.textContent).toContain('Brightline Logistics');
    expect(maya.querySelector('a[href="https://brightline.example/home"]').textContent).toBe('brightline.example');
    expect(maya.querySelector('[data-outreach-status]').textContent).toBe('Watched');
    expect(maya.querySelector('[data-outreach-watch]').textContent).toBe('92%');
    expect(maya.querySelector('[data-outreach-heard]').textContent).toBe('Hears: “Hi Maya!”');
    maya.querySelector('[data-outreach-share]').click();
    expect(share).toHaveBeenCalledWith(links[0]);
    maya.querySelector('[data-outreach-more]').click();
    maya.querySelector('[data-outreach-gmail]').click();
    expect(sentAction).toHaveBeenCalled();
  });

  it('filters', () => {
    const setFilter = vi.fn();
    document.body.appendChild(renderProspectTable({ links, contacts, stats, filter: 'sent', setFilter }));
    expect([...document.querySelectorAll('[data-outreach-link-row]')].map((r) => r.dataset.outreachLinkRow)).toEqual(['m', 's']);
    expect(document.querySelector('[data-prospect-filter="sent"]').getAttribute('aria-selected')).toBe('true');
    document.querySelector('[data-prospect-filter="watched"]').click();
    expect(setFilter).toHaveBeenCalledWith('watched');
    expect(document.querySelector('[data-prospect-filter="all"]').textContent).toBe('All 4');
  });
  it('marks prospects whose video uses the fallback website', () => {
    const box = renderProspectTable({ links: [{ ...links[0], site: 'own' }, { ...links[1], site: 'fallback', siteError: true }, { ...links[2], site: 'fallback' }], contacts });
    const marks = [...box.querySelectorAll('[data-outreach-fallback]')].map((n) => n.getAttribute('data-outreach-fallback'));
    expect(marks).toEqual(['error', 'none']);
    expect(box.querySelector('[data-outreach-link-row="m"] [data-outreach-fallback]')).toBeNull();
  });
  it('has a Delete button per row only when deleting is allowed', () => {
    expect(renderProspectTable({ links, contacts }).querySelector('[data-outreach-delete]')).toBeNull();
    const remove = vi.fn();
    const box = renderProspectTable({ links, contacts, remove });
    expect(box.querySelectorAll('[data-outreach-delete]').length).toBe(links.length);
    box.querySelector('[data-outreach-link-row="s"] [data-outreach-delete]').click();
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ contactId: 's' }));
  });
});
