import { describe, it, expect, vi } from 'vitest';
import {
  TEMPLATES, defaultConfig, sanitizeConfig, fillTokens, tokensUsed, tokensFromQuery, safeUrl, safeImageUrl,
} from '../templates.js';
import {
  isPermanentUrl, fromGeneration, fromContent, fromAsset, fromRender, fromFile, mergeSources, loadVideoSources,
} from '../sourceRegistry.js';
import { ensurePermanent, createPageFromVideo, IngestError, MAX_VIDEO_BYTES } from '../ingest.js';
import {
  pageUrl, personalUrl, embedCode, fetchPublicPage, fetchContactTokens, recordPageEvent, submitPageLead, createPage, addContacts, fetchPageStats,
} from '../client.js';

const PERM = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';

describe('templates', () => {
  it('has unique template ids and a default config for each', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    TEMPLATES.forEach((t) => {
      const c = defaultConfig(t.id, { title: 'Hello' });
      expect(c.template).toBe(t.id);
      expect(c.theme.accent).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it('sanitizes unsafe and oversized input', () => {
    const c = sanitizeConfig({
      template: 'nope',
      theme: { accent: 'red', logoUrl: 'javascript:alert(1)', font: 'comic' },
      headline: 'x'.repeat(500),
      cta: { label: 'Go', url: 'javascript:alert(1)', type: 'weird' },
      form: { enabled: true, fields: [{ key: 'Email!', label: 'Email', type: 'email' }, { key: 'email', label: 'dupe' }, { key: '', label: 'no key' }] },
      sections: Array.from({ length: 20 }, (_, i) => ({ heading: `h${i}`, body: '' })),
    });
    expect(c.template).toBe('clean');
    expect(c.theme.accent).toBe(TEMPLATES[0].theme.accent);
    expect(c.theme.logoUrl).toBe('');
    expect(c.theme.font).toBe('system');
    expect(c.headline).toHaveLength(200);
    expect(c.cta.url).toBe('');
    expect(c.cta.type).toBe('link');
    expect(c.form.fields).toEqual([{ key: 'email', label: 'Email', type: 'email', required: false, placeholder: '' }]);
    expect(c.sections).toHaveLength(6);
  });

  it('never throws on garbage', () => {
    [null, undefined, 5, 'x', [], { form: 3, theme: 'a', cta: [] }].forEach((v) => expect(() => sanitizeConfig(v)).not.toThrow());
  });

  it('disables the form when no valid fields remain', () => {
    expect(sanitizeConfig({ form: { enabled: true, fields: [] } }).form.enabled).toBe(false);
  });

  it('only allows http(s)/mailto/tel links and https images', () => {
    expect(safeUrl('https://a.com')).toBe('https://a.com');
    expect(safeUrl('tel:+15551234')).toBe('tel:+15551234');
    expect(safeUrl('data:text/html,x')).toBe('');
    expect(safeImageUrl('http://a.com/x.png')).toBe('');
    expect(safeImageUrl('https://a.com/x.png')).toBe('https://a.com/x.png');
  });

  it('fills tokens with fallbacks and never leaves braces', () => {
    expect(fillTokens('Hi {{firstname|there}}!', { firstname: 'Ann' })).toBe('Hi Ann!');
    expect(fillTokens('Hi {{firstname|there}}!', {})).toBe('Hi there!');
    expect(fillTokens('Hi {{ firstname }}!', {})).toBe('Hi !');
    expect(fillTokens('{{company|your team}}', { company: '  ' })).toBe('your team');
  });

  it('lists tokens used and reads allowed ones from the query', () => {
    expect(tokensUsed({ headline: 'Hi {{firstname}}', subhead: '{{company|x}}' }).sort()).toEqual(['company', 'firstname']);
    expect(tokensFromQuery('?firstname=Ann&email=a@b.c&c=abc&company=Acme')).toEqual({ firstname: 'Ann', company: 'Acme' });
  });
});

describe('sourceRegistry', () => {
  it('detects permanent urls', () => {
    expect(isPermanentUrl(PERM)).toBe(true);
    expect(isPermanentUrl('https://cdn.muapi.ai/out.mp4')).toBe(false);
    expect(isPermanentUrl('blob:http://x/1')).toBe(false);
    expect(isPermanentUrl('http://x/storage/v1/object/public/a.mp4')).toBe(false);
  });

  it('normalizes generation, content, asset and render records', () => {
    expect(fromGeneration({ id: 'g1', url: 'https://cdn/x.mp4', type: 'video', studio: 'cinema', prompt: 'A fox', thumbnail_url: 'https://cdn/t.jpg' }))
      .toMatchObject({ key: 'generation:g1', title: 'A fox', posterUrl: 'https://cdn/t.jpg', permanent: false, source: { kind: 'generation', studio: 'cinema', id: 'g1' } });
    expect(fromGeneration({ id: 'i1', url: 'https://cdn/x.png', type: 'image' })).toBeNull();
    expect(fromContent({ id: 'c1', url: PERM, type: 'video', filename: 'demo.mp4' })).toMatchObject({ permanent: true, title: 'demo.mp4' });
    expect(fromAsset({ id: 'a1', url: PERM, type: 'video/mp4', name: 'Intro' })).toMatchObject({ key: 'asset:a1', title: 'Intro' });
    expect(fromAsset({ id: 'a2', url: PERM, type: 'image/png', name: 'pic' })).toBeNull();
    expect(fromRender('https://cdn/final.mp4', 'proj')).toMatchObject({ source: { kind: 'render', studio: 'openmontage' } });
    expect(fromRender({ path: '/local/final.mp4' })).toBeNull(); // local paths are not https; kept out of the picker
  });

  it('turns a picked File into a source and rejects non-video files', () => {
    const f = new File(['abc'], 'My Clip.mp4', { type: 'video/mp4' });
    expect(fromFile(f, 'blob:x')).toMatchObject({ title: 'My Clip', url: 'blob:x', permanent: false, source: { kind: 'upload' } });
    expect(fromFile(new File(['a'], 'a.png', { type: 'image/png' }), 'blob:y')).toBeNull();
  });

  it('merges by url (first wins) and sorts newest first', () => {
    const a = { url: 'u1', title: 'a', createdAt: '2026-01-01' };
    const b = { url: 'u2', title: 'b', createdAt: '2026-03-01' };
    const dup = { url: 'u1', title: 'dup', createdAt: '2026-05-01' };
    expect(mergeSources([a, b], [dup, null]).map((v) => v.title)).toEqual(['b', 'a']);
  });

  it('keeps going when one store fails', async () => {
    const out = await loadVideoSources({
      loaders: {
        generations: async () => { throw new Error('boom'); },
        content: async () => [{ id: 'c', url: PERM, type: 'video', created_at: '2026-01-01' }],
        assets: async () => [],
      },
    });
    expect(out).toHaveLength(1);
  });
});

describe('ingest', () => {
  it('keeps permanent urls without uploading', async () => {
    const upload = vi.fn();
    expect(await ensurePermanent({ url: PERM }, { upload })).toBe(PERM);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rehosts expiring urls', async () => {
    const upload = vi.fn(async () => ({ url: PERM }));
    const fetchImpl = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['video'], { type: 'video/mp4' }) }));
    expect(await ensurePermanent({ url: 'https://cdn/x.mp4', title: 'My video' }, { upload, fetchImpl })).toBe(PERM);
    const file = upload.mock.calls[0][0];
    expect(file.type).toBe('video/mp4');
    expect(file.name).toBe('My-video.mp4');
  });

  it('uploads a picked File directly', async () => {
    const upload = vi.fn(async () => ({ url: PERM }));
    const file = new File(['abc'], 'clip.mp4', { type: 'video/mp4' });
    await ensurePermanent({ url: 'blob:x', file }, { upload, fetchImpl: () => { throw new Error('should not fetch'); } });
    expect(upload.mock.calls[0][0]).toBe(file);
  });

  it('explains blocked downloads, bad responses, oversize and failed uploads', async () => {
    const upload = vi.fn(async () => ({ url: PERM }));
    await expect(ensurePermanent({ url: 'https://cdn/x.mp4' }, { upload, fetchImpl: async () => { throw new TypeError('cors'); } }))
      .rejects.toMatchObject({ code: 'fetch_blocked' });
    await expect(ensurePermanent({ url: 'https://cdn/x.mp4' }, { upload, fetchImpl: async () => ({ ok: false, status: 403 }) }))
      .rejects.toMatchObject({ code: 'fetch_failed' });
    const big = { size: MAX_VIDEO_BYTES + 1, type: 'video/mp4' };
    await expect(ensurePermanent({ url: 'https://cdn/x.mp4' }, { upload, fetchImpl: async () => ({ ok: true, blob: async () => big }) }))
      .rejects.toMatchObject({ code: 'too_large' });
    await expect(ensurePermanent({ url: 'https://cdn/x.mp4' }, { upload: async () => ({ url: 'blob:no' }), fetchImpl: async () => ({ ok: true, blob: async () => new Blob(['v']) }) }))
      .rejects.toBeInstanceOf(IngestError);
    await expect(ensurePermanent({ url: 'https://cdn/x.mp4' }, {})).rejects.toMatchObject({ code: 'no_upload' });
  });

  it('creates a draft page from a video', async () => {
    const inserted = [];
    const client = {
      from: () => ({
        insert: (row) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: { ...row, view_count: 0 }, error: null }) }) }; },
      }),
    };
    const page = await createPageFromVideo(
      client,
      { url: PERM, title: 'Launch', posterUrl: 'https://x/p.jpg', duration: 12, source: { kind: 'generation' } },
      { template: 'personal', deps: {} },
    );
    expect(page.published).toBe(false);
    expect(page.video_url).toBe(PERM);
    expect(page.poster_url).toBe('https://x/p.jpg');
    expect(page.config.template).toBe('personal');
    expect(page.config.headline).toContain('{{firstname|there}}');
    expect(page.id).toMatch(/^[A-Za-z0-9_-]{8,32}$/);
  });
});

describe('client', () => {
  const cfg = { url: 'https://x.supabase.co', key: 'anon' };

  it('builds page, personal and embed urls', () => {
    expect(pageUrl('abc12345', 'https://s.io')).toBe('https://s.io/p/abc12345');
    expect(personalUrl('abc12345', 'ct_01', 'https://s.io')).toBe('https://s.io/p/abc12345?c=ct_01');
    expect(embedCode('abc12345', 'https://s.io')).toContain('https://s.io/p/abc12345?embed=1');
  });

  it('refuses insecure video urls', async () => {
    await expect(createPage({}, { videoUrl: 'http://x/a.mp4' })).rejects.toThrow(/https/);
  });

  it('fetches only published pages and validates the id', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => [{ id: 'abc12345' }] }));
    expect(await fetchPublicPage('bad id', { ...cfg, fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await fetchPublicPage('abc12345', { ...cfg, fetchImpl })).toEqual({ id: 'abc12345' });
    expect(fetchImpl.mock.calls[0][0]).toContain('published=eq.true');
  });

  it('returns {} for missing/invalid contacts and for failures', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ firstname: 'Ann' }) }));
    expect(await fetchContactTokens('abc12345', 'no', { ...cfg, fetchImpl })).toEqual({});
    expect(await fetchContactTokens('abc12345', 'contact_01', { ...cfg, fetchImpl })).toEqual({ firstname: 'Ann' });
    expect(await fetchContactTokens('abc12345', 'contact_01', { ...cfg, fetchImpl: async () => { throw new Error('x'); } })).toEqual({});
  });

  it('records only known event kinds and drops bad contact ids', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    await recordPageEvent('abc12345', { kind: 'hack' }, { ...cfg, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    await recordPageEvent('abc12345', { kind: 'progress_50', contactId: 'bad id!' }, { ...cfg, fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ page_id: 'abc12345', kind: 'progress_50', contact_id: null });
  });

  it('submits leads and reports failures without throwing', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, stored: true }) }));
    expect(await submitPageLead({ pageId: 'abc12345', data: { email: 'a@b.c' } }, { ...cfg, fetchImpl: ok })).toEqual({ stored: true, error: null });
    expect(JSON.parse(ok.mock.calls[0][1].body)).toMatchObject({ pageId: 'abc12345', kind: 'lead-form' });
    const bad = async () => ({ ok: false, status: 429, json: async () => ({ error: 'slow down' }) });
    expect(await submitPageLead({ pageId: 'abc12345', data: {} }, { ...cfg, fetchImpl: bad })).toEqual({ stored: false, error: 'slow down' });
  });

  it('inserts contacts in chunks with generated ids', async () => {
    const batches = [];
    const client = {
      from: () => ({ insert: (rows) => { batches.push(rows); return { select: async () => ({ data: rows, error: null }) }; } }),
    };
    const contacts = Array.from({ length: 450 }, (_, i) => ({ fields: { firstname: `n${i}` } }));
    const stored = await addContacts(client, 'abc12345', contacts, { chunk: 200 });
    expect(batches.map((b) => b.length)).toEqual([200, 200, 50]);
    expect(stored).toHaveLength(450);
    expect(new Set(stored.map((r) => r.id)).size).toBe(450);
    expect(batches[0][0].page_id).toBe('abc12345');
  });

  it('maps stats rows', async () => {
    const client = { rpc: async () => ({ data: [{ views: '5', plays: 3, completes: 1, cta_clicks: 2, leads: 1, unique_contacts: '4' }], error: null }) };
    expect(await fetchPageStats(client, 'abc12345')).toEqual({ views: 5, plays: 3, completes: 1, ctaClicks: 2, leads: 1, uniqueContacts: 4 });
  });
});
