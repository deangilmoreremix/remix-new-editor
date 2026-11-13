import { describe, it, expect, vi } from 'vitest';
import { captureAttribution, sourceLabel } from '../attribution.js';
import { submitViewerLead } from '../publishClient.js';

const own = { ownOrigin: 'https://app.test' };

describe('captureAttribution', () => {
  it('reads utm_* tags and the referring page (origin + path only)', () => {
    const out = captureAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=spring%20sale&firstname=Ann', 'https://news.example.com/post?token=secret#x', { mode: 'full', ...own });
    expect(out).toEqual({ utm: { source: 'google', medium: 'cpc', campaign: 'spring sale' }, referrer: 'https://news.example.com/post' });
    expect(JSON.stringify(out)).not.toMatch(/secret|Ann/);
  });

  it('records nothing for an opted-out viewer, but still works for anonymous mode', () => {
    expect(captureAttribution('?utm_source=g', 'https://r.test/', { mode: 'off', ...own })).toEqual({});
    expect(captureAttribution('?utm_source=g', '', { mode: 'anonymous', ...own })).toEqual({ utm: { source: 'g' } });
  });

  it('ignores same-site and non-web referrers, empty tags, and control characters', () => {
    expect(captureAttribution('', 'https://app.test/other', { mode: 'full', ...own })).toEqual({});
    expect(captureAttribution('', 'android-app://com.x', { mode: 'full', ...own })).toEqual({});
    expect(captureAttribution('?utm_source=&utm_term=%0Ab%00c', '', { mode: 'full', ...own })).toEqual({ utm: { term: 'bc' } });
    expect(captureAttribution('?utm_source=' + 'a'.repeat(300), '', { mode: 'full', ...own }).utm.source).toHaveLength(100);
  });

  it('labels a lead by campaign, else referring host', () => {
    expect(sourceLabel({ utm: { source: 'google', campaign: 'spring' } })).toBe('google / spring');
    expect(sourceLabel({ utm: { campaign: 'spring' } })).toBe('spring');
    expect(sourceLabel({ referrer: 'https://news.example.com/post' })).toBe('news.example.com');
    expect(sourceLabel({})).toBe('');
    expect(sourceLabel(undefined)).toBe('');
  });
});

describe('submitViewerLead source', () => {
  it('sends the attribution in source, and nothing extra when there is none', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, stored: true }) });
    const env = { url: 'https://p.supabase.co', key: 'k', fetchImpl };
    await submitViewerLead({ publishedId: 'abcdefgh12', clipId: 7, kind: 'lead-form', data: { EMAIL: 'a@b.co' }, attribution: { utm: { source: 'g' }, referrer: 'https://r.test/p' } }, env);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).source).toMatchObject({ utm: { source: 'g' }, referrer: 'https://r.test/p' });
    await submitViewerLead({ publishedId: 'abcdefgh12', clipId: 7, kind: 'lead-form', data: { EMAIL: 'a@b.co' } }, env);
    const source = JSON.parse(fetchImpl.mock.calls[1][1].body).source;
    expect(source).not.toHaveProperty('utm');
    expect(source).not.toHaveProperty('referrer');
  });
});
