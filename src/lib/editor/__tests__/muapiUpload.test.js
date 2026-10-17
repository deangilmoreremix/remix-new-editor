import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Dynamic-import interception for the Asset Library seam. The adapter resolves
// this specifier relative to src/lib/, so from this __tests__ dir it is
// ../../assetLibrary.js. A factory mock works whether or not the owned file
// has been created yet.
const { resolvePermanentMediaReference } = vi.hoisted(() => ({
    resolvePermanentMediaReference: vi.fn(),
}));
vi.mock('../../assetLibrary.js', () => ({ resolvePermanentMediaReference }));

import {
    MUAPI_UPLOAD_URL,
    MuapiUploadError,
    validateMuAPIUpload,
    handleMuAPIUploadError,
    uploadImageToMuAPI,
    uploadVideoToMuAPI,
    resolveMuAPIMediaInput,
    getCachedMuapiUpload,
    clearMuapiUploadCache,
} from '../../muapiUpload.js';

// ---------------------------------------------------------------------------
// Fixtures — real magic bytes so file-type detects them.
// ---------------------------------------------------------------------------
const PNG_HEADER = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 10, 0, 0, 0, 10, 8, 6, 0, 0, 0];
const JPEG_HEADER = [0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 0, 0xFF, 0xD9];
const MP4_HEADER = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32];

function bytesWithHeader(header, size) {
    const bytes = new Uint8Array(size);
    bytes.set(header, 0);
    return bytes;
}
const makePng = (size) => new File([bytesWithHeader(PNG_HEADER, size)], 'test.png', { type: 'image/png' });
const makeJpeg = (size) => new File([bytesWithHeader(JPEG_HEADER, size)], 'test.jpg', { type: 'image/jpeg' });
const makeMp4 = (size) => new File([bytesWithHeader(MP4_HEADER, size)], 'test.mp4', { type: 'video/mp4' });
const makeUnknown = () => new File([bytesWithHeader([0x13, 0x37, 0x13, 0x37, 0xDE, 0xAD, 0xBE, 0xEF, 0, 1, 2, 3, 4, 5, 6, 7], 64)], 'evil.exe', { type: 'application/x-msdownload' });

const KEY = 'muapi_byok_test_key_0123456789';
const AUTH = { userId: '', workspaceId: '', muapiKey: KEY };

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status });
const okUpload = (url) => json({ url });

beforeEach(() => {
    clearMuapiUploadCache();
    resolvePermanentMediaReference.mockReset();
});

afterEach(() => {
    clearMuapiUploadCache();
});

// ---------------------------------------------------------------------------
// validateMuAPIUpload
// ---------------------------------------------------------------------------
describe('validateMuAPIUpload', () => {
    it('accepts PNG and JPEG <= 10MB and MP4 <= 50MB', async () => {
        await expect(validateMuAPIUpload(makePng(1024))).resolves.toMatchObject({ category: 'image', sizeBytes: 1024 });
        await expect(validateMuAPIUpload(makeJpeg(1024))).resolves.toMatchObject({ category: 'image' });
        await expect(validateMuAPIUpload(makePng(10 * 1024 * 1024))).resolves.toMatchObject({ category: 'image' });
        await expect(validateMuAPIUpload(makeMp4(50 * 1024 * 1024))).resolves.toMatchObject({ category: 'video' });
    });

    it('rejects an 11MB image (MUAPI_FILE_TOO_LARGE)', async () => {
        await expect(validateMuAPIUpload(makePng(11 * 1024 * 1024))).rejects.toMatchObject({ code: 'MUAPI_FILE_TOO_LARGE' });
    });

    it('rejects a 51MB video (MUAPI_FILE_TOO_LARGE)', async () => {
        await expect(validateMuAPIUpload(makeMp4(51 * 1024 * 1024))).rejects.toMatchObject({ code: 'MUAPI_FILE_TOO_LARGE' });
    });

    it('rejects an unsupported type (MUAPI_UNSUPPORTED_FORMAT)', async () => {
        const err = await validateMuAPIUpload(makeUnknown()).catch((e) => e);
        expect(err).toBeInstanceOf(MuapiUploadError);
        expect(err.code).toBe('MUAPI_UNSUPPORTED_FORMAT');
    });

    it('rejects a missing file (MUAPI_NO_FILE)', async () => {
        await expect(validateMuAPIUpload(null)).rejects.toMatchObject({ code: 'MUAPI_NO_FILE' });
    });
});

// ---------------------------------------------------------------------------
// uploadImageToMuAPI transport (small -> proxy, large -> direct)
// ---------------------------------------------------------------------------
describe('uploadImageToMuAPI transport', () => {
    it('posts multipart with a `file` field and x-api-key (no manual boundary) via the proxy for small files', async () => {
        global.fetch = vi.fn(async () => okUpload('https://cdn.muapi.ai/x.png'));
        const res = await uploadImageToMuAPI(makePng(2048), AUTH);

        expect(res.url).toBe('https://cdn.muapi.ai/x.png');
        expect(res.category).toBe('image');
        expect(res.source).toBe('file');
        expect(res.expiresAt - res.uploadedAt).toBe(60 * 60 * 1000);

        const call = global.fetch.mock.calls[0];
        expect(call[0]).toContain('/functions/v1/muapi-proxy');
        expect(call[1].method).toBe('POST');
        expect(call[1].body).toBeInstanceOf(FormData);
        expect(call[1].body.get('file')).toBeTruthy();
        expect(call[1].headers['x-api-key']).toBe(KEY);
        expect(call[1].headers['x-endpoint']).toBe('upload_file');
        expect('Content-Type' in call[1].headers).toBe(false);
    });

    it('routes large files (>8MB) directly to MUAPI_UPLOAD_URL', async () => {
        global.fetch = vi.fn(async () => okUpload('https://cdn.muapi.ai/big.png'));
        await uploadImageToMuAPI(makePng(9 * 1024 * 1024), AUTH);

        const call = global.fetch.mock.calls[0];
        expect(call[0]).toBe(MUAPI_UPLOAD_URL);
        expect(call[1].headers['x-api-key']).toBe(KEY);
        expect(call[1].headers['x-endpoint']).toBeUndefined();
        expect('Content-Type' in call[1].headers).toBe(false);
        expect(call[1].body).toBeInstanceOf(FormData);
    });

    it('parses result.data.url when result.url is absent', async () => {
        global.fetch = vi.fn(async () => json({ data: { url: 'https://cdn.muapi.ai/nested.png' } }));
        const res = await uploadImageToMuAPI(makePng(2048), AUTH);
        expect(res.url).toBe('https://cdn.muapi.ai/nested.png');
    });

    it('throws MUAPI_KEY_MISSING (before any network call) when no key is available', async () => {
        global.fetch = vi.fn(async () => okUpload('https://x/y.png'));
        const err = await uploadImageToMuAPI(makePng(512), { userId: '', workspaceId: '' }).catch((e) => e);
        expect(err).toBeInstanceOf(MuapiUploadError);
        expect(err.code).toBe('MUAPI_KEY_MISSING');
        expect(err.userMessage).toContain('Settings');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a non-image passed to uploadImageToMuAPI', async () => {
        global.fetch = vi.fn(async () => okUpload('https://x/y.png'));
        const err = await uploadImageToMuAPI(makeMp4(2048), AUTH).catch((e) => e);
        expect(err.code).toBe('MUAPI_UNSUPPORTED_FORMAT');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// uploadVideoToMuAPI
// ---------------------------------------------------------------------------
describe('uploadVideoToMuAPI', () => {
    it('uploads a small MP4 through the proxy and returns category video', async () => {
        global.fetch = vi.fn(async () => okUpload('https://cdn.muapi.ai/v.mp4'));
        const res = await uploadVideoToMuAPI(makeMp4(4096), AUTH);
        expect(res.category).toBe('video');
        expect(res.url).toBe('https://cdn.muapi.ai/v.mp4');
        expect(global.fetch.mock.calls[0][0]).toContain('/functions/v1/muapi-proxy');
    });
});

// ---------------------------------------------------------------------------
// HTTP failure mapping + retry policy
// ---------------------------------------------------------------------------
describe('failure mapping + bounded retries', () => {
    it('402 -> MUAPI_INSUFFICIENT_CREDITS, non-retryable (exactly one attempt)', async () => {
        global.fetch = vi.fn(async () => json({ error: 'no credits' }, 402));
        const err = await uploadImageToMuAPI(makePng(512), AUTH).catch((e) => e);
        expect(err.code).toBe('MUAPI_INSUFFICIENT_CREDITS');
        expect(err.retryable).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry 400/401/413 (each exactly one attempt)', async () => {
        for (const status of [400, 401, 403, 413, 415]) {
            clearMuapiUploadCache();
            const f = vi.fn(async () => json({ error: 'x' }, status));
            global.fetch = f;
            const err = await uploadImageToMuAPI(makePng(512), AUTH).catch((e) => e);
            expect(err.code).not.toBe(undefined);
            expect(f).toHaveBeenCalledTimes(1);
        }
    });

    it('429 retried then fails with MUAPI_RATE_LIMITED (bounded, exactly 3 attempts)', async () => {
        global.fetch = vi.fn(async () => json({ error: 'slow down' }, 429));
        const err = await uploadImageToMuAPI(makePng(512), AUTH).catch((e) => e);
        expect(err.code).toBe('MUAPI_RATE_LIMITED');
        expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 20000);

    it('retry cap on network errors: exactly 3 attempts, no infinite loop', async () => {
        global.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        const err = await uploadImageToMuAPI(makePng(512), AUTH).catch((e) => e);
        expect(err.code).toBe('MUAPI_NETWORK');
        expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 20000);

    it('ok response with no URL -> MUAPI_INVALID_RESPONSE, never a success', async () => {
        global.fetch = vi.fn(async () => json({ id: 'req_1', status: 'queued' }, 200));
        const err = await uploadImageToMuAPI(makePng(512), AUTH).catch((e) => e);
        expect(err.code).toBe('MUAPI_INVALID_RESPONSE');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('honors an AbortSignal (cancelled, no throw-as-success)', async () => {
        const controller = new AbortController();
        controller.abort();
        global.fetch = vi.fn(async () => okUpload('https://x/y.png'));
        const err = await uploadImageToMuAPI(makePng(512), AUTH, { signal: controller.signal }).catch((e) => e);
        expect(err.code).toBe('MUAPI_CANCELLED');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// resolveMuAPIMediaInput (permanent asset -> fresh MuAPI URL) + cache
// ---------------------------------------------------------------------------
describe('resolveMuAPIMediaInput + upload cache', () => {
    const DOWNLOAD_URL = 'https://projectref.supabase.co/storage/v1/object/public/uploads/u/a.png';
    const FRESH_URL = 'https://cdn.muapi.ai/fresh-a.png';

    function wirePermanentAsset() {
        resolvePermanentMediaReference.mockResolvedValue({
            url: DOWNLOAD_URL,
            path: 'u/a.png',
            name: 'a.png',
            mime: 'image/png',
            category: 'image',
            sizeBytes: 1024,
        });
        global.fetch = vi.fn(async (url) => {
            if (url === DOWNLOAD_URL) {
                return new Response(bytesWithHeader(PNG_HEADER, 1024), { status: 200 });
            }
            return okUpload(FRESH_URL);
        });
    }

    it('cache miss re-uploads from the permanent reference (source "asset"), then a live cache hit (source "cache")', async () => {
        wirePermanentAsset();
        const r1 = await resolveMuAPIMediaInput('asset_1', AUTH);
        expect(r1.source).toBe('asset');
        expect(r1.url).toBe(FRESH_URL);
        expect(global.fetch).toHaveBeenCalledTimes(2); // download + upload

        const r2 = await resolveMuAPIMediaInput('asset_1', AUTH);
        expect(r2.source).toBe('cache');
        expect(r2.url).toBe(FRESH_URL);
        expect(global.fetch).toHaveBeenCalledTimes(2); // no new network calls
    });

    it('expired cache entry forces a fresh re-upload', async () => {
        wirePermanentAsset();
        await resolveMuAPIMediaInput('asset_2', AUTH);
        expect(global.fetch).toHaveBeenCalledTimes(2);

        const entry = getCachedMuapiUpload('asset_2', AUTH);
        expect(entry).toBeTruthy();
        entry.expiresAt = Date.now() - 60_000; // already expired

        const r = await resolveMuAPIMediaInput('asset_2', AUTH);
        expect(r.source).toBe('asset');
        expect(global.fetch).toHaveBeenCalledTimes(4); // download + upload again
    });

    it('re-upload failures throw MUAPI_REUPLOAD_FAILED (not a fabricated success)', async () => {
        resolvePermanentMediaReference.mockRejectedValue(new Error('boom'));
        global.fetch = vi.fn(async () => okUpload(FRESH_URL));
        const err = await resolveMuAPIMediaInput('asset_3', AUTH).catch((e) => e);
        expect(err.code).toBe('MUAPI_REUPLOAD_FAILED');
    });

    it('clearMuapiUploadCache drops entries (simulates a refresh)', async () => {
        wirePermanentAsset();
        await resolveMuAPIMediaInput('asset_4', AUTH);
        expect(getCachedMuapiUpload('asset_4', AUTH)).toBeTruthy();
        clearMuapiUploadCache();
        expect(getCachedMuapiUpload('asset_4', AUTH)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// handleMuAPIUploadError mapping + key-redaction guarantee
// ---------------------------------------------------------------------------
describe('handleMuAPIUploadError', () => {
    it('maps status codes to stable codes', () => {
        const cases = [
            [401, 'MUAPI_AUTH_FAILED', false],
            [403, 'MUAPI_AUTH_FAILED', false],
            [402, 'MUAPI_INSUFFICIENT_CREDITS', false],
            [400, 'MUAPI_UNSUPPORTED_FORMAT', false],
            [415, 'MUAPI_UNSUPPORTED_FORMAT', false],
            [413, 'MUAPI_FILE_TOO_LARGE', false],
            [429, 'MUAPI_RATE_LIMITED', true],
            [503, 'MUAPI_PROVIDER_ERROR', true],
            [500, 'MUAPI_PROVIDER_ERROR', true],
            [404, 'MUAPI_PROVIDER_ERROR', false],
        ];
        for (const [status, code, retryable] of cases) {
            const d = handleMuAPIUploadError(Object.assign(new Error('x'), { status }));
            expect(d.code).toBe(code);
            expect(d.retryable).toBe(retryable);
        }
    });

    it('maps network / timeout / cancel signals', () => {
        const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
        expect(handleMuAPIUploadError(abort).code).toBe('MUAPI_CANCELLED');
        expect(handleMuAPIUploadError(new Error('network down')).code).toBe('MUAPI_NETWORK');
        expect(handleMuAPIUploadError(new TypeError('Failed to fetch')).code).toBe('MUAPI_NETWORK');
    });

    it('maps a MISSING KEY error to MUAPI_KEY_MISSING with a Settings hint', () => {
        const d = handleMuAPIUploadError(new MuapiUploadError('MUAPI_KEY_MISSING', 'x'));
        expect(d.code).toBe('MUAPI_KEY_MISSING');
        expect(d.userMessage).toContain('Settings');
    });

    it('never embeds the API key in message or userMessage', () => {
        const SENTINEL = 'SECRETKEY_SENTINEL_abcdef0123456789';
        const noisy = [
            new Error(`Request failed with x-api-key ${SENTINEL} upstream`),
            Object.assign(new Error(`401 unauthorized key=${SENTINEL}`), { status: 401 }),
            Object.assign(new Error(`402 insufficient credits (key ${SENTINEL})`), { status: 402 }),
            new MuapiUploadError('MUAPI_NETWORK', `leaked ${SENTINEL}`, { userMessage: `${SENTINEL} leak` }),
        ];
        for (const e of noisy) {
            const d = handleMuAPIUploadError(e);
            expect(`${d.message} ${d.userMessage}`).not.toContain(SENTINEL);
        }
    });
});
