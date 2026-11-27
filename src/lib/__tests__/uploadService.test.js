// uploadService: files go under smartvideo/<signed-in id or anonymous>/ (the only prefix the shared `uploads`
// bucket lets this app write to), a refused upload throws instead of returning a link to a missing file,
// and the extension is not doubled.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ userId: null, token: null, result: { data: { path: 'p' }, error: null }, calls: [] }));

vi.mock('../supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (path, file, opts) => { state.calls.push({ path, opts }); return state.result; },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/uploads/${path}` } }),
      }),
    },
  },
  isSupabaseConfigured: () => true,
  getSupabaseUrl: () => 'https://example.supabase.co',
  getSupabaseAnonKey: () => 'anon',
  getClerkUserId: () => state.userId,
  primeSupabaseIdentity: async () => state.token,
}));

const { uploadFileToSupabase, buildObjectPath, UploadError } = await import('../uploadService.js');

const video = (name = 'clip.mp4') => new File([new Uint8Array(32)], name, { type: 'video/mp4' });

describe('uploadService', () => {
  beforeEach(() => { state.userId = null; state.token = null; state.result = { data: { path: 'p' }, error: null }; state.calls = []; });

  it('stores a signed-in user\'s file under smartvideo/<clerk id>/', async () => {
    state.userId = 'user_3MfT6NOVQzLHoTpgEs1zJZkaFmX';
    state.token = 'verified-jwt';
    const out = await uploadFileToSupabase(video(), { category: 'video', userId: 'user_someKeyHash' });
    expect(state.calls[0].path).toMatch(/^smartvideo\/user_3MfT6NOVQzLHoTpgEs1zJZkaFmX\/\d+_[a-z0-9]+_clip\.mp4$/);
    expect(out.url).toContain('/uploads/smartvideo/user_3MfT6NOVQzLHoTpgEs1zJZkaFmX/');
  });

  it('stores a signed-out file under smartvideo/anonymous/', async () => {
    await uploadFileToSupabase(video(), { category: 'video' });
    expect(state.calls[0].path.startsWith('smartvideo/anonymous/')).toBe(true);
  });

  it('signed in but the token exchange is down: uploads as anonymous, matching the request it really sends', async () => {
    state.userId = 'user_3MfT6NOVQzLHoTpgEs1zJZkaFmX';
    state.token = null;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await uploadFileToSupabase(video(), { category: 'video' });
    expect(state.calls[0].path.startsWith('smartvideo/anonymous/')).toBe(true);
  });

  it('does not double the extension', () => {
    expect(buildObjectPath({ name: 't2.mp4' }, 'u1')).toMatch(/_t2\.mp4$/);
    expect(buildObjectPath({ name: 'my clip.final.MOV' }, 'u1')).toMatch(/_my_clip\.final\.mov$/);
  });

  it('throws when storage refuses the upload instead of returning a dead link', async () => {
    state.result = { data: null, error: { statusCode: '400', message: 'invalid input syntax for type uuid' } };
    await expect(uploadFileToSupabase(video(), { category: 'video' })).rejects.toBeInstanceOf(UploadError);
  });

  it('gives a sign-in hint when the storage rules refuse it', async () => {
    state.result = { data: null, error: { statusCode: '403', message: 'new row violates row-level security policy' } };
    await expect(uploadFileToSupabase(video(), { category: 'video' })).rejects.toThrow(/Sign in and try again/);
  });
});
