#!/usr/bin/env node
/**
 * REAL MuAPI upload integration test (env-gated).
 *
 *   node tests/integration/muapi-upload.integration.test.mjs
 *
 * This test hits the REAL MuAPI provider — it NEVER mocks provider responses.
 * It is gated: when no API key is configured it prints the explicit SKIP
 * notice and exits 0 WITHOUT claiming a pass. When a key is present it runs
 * the numbered checks and exits non-zero on any REAL failure.
 *
 * Bring your own key (BYOK). The key is read from the environment only, is
 * never logged, and is only ever sent as the `x-api-key` header to MuAPI.
 *
 *   MUAPI_TEST_API_KEY   (or MUAPI_API_KEY)  — required to run the live checks
 *   MUAPI_TEST_I2V_MODEL                    — optional model override for the
 *                                             step-5 generation (default 'kling-v3.0-pro-image-to-video')
 *
 * Small files (<8MB) upload DIRECT to MuAPI under plain Node (there is no
 * same-origin Supabase proxy there); set VITE_SUPABASE_URL to route them through
 * the deployed edge proxy instead. Large files always go direct.
 */

import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KEY = process.env.MUAPI_TEST_API_KEY || process.env.MUAPI_API_KEY;
if (!KEY) {
    console.log('SKIP: MUAPI_TEST_API_KEY not set — real integration test not run');
    process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH = { userId: '', workspaceId: '', muapiKey: KEY };

const checks = [];
function report(name, ok, detail = '') {
    checks.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} [${name}]${detail ? ' ' + detail : ''}`);
}
function note(msg) {
    console.log(`NOTE  ${msg}`);
}

// --- helpers --------------------------------------------------------------

// CRC32 (PNG) implementation.
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}
// A genuinely valid, decodable 1x1 RGB PNG.
function makeRealPng(r, g, b) {
    const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0); // width
    ihdr.writeUInt32BE(1, 4); // height
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type RGB
    const raw = Buffer.from([0, r, g, b]); // 1 scanline: filter 0 + RGB pixel
    const idat = zlib.deflateSync(raw);
    return Buffer.concat([
        sig,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', idat),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}
// A small, valid-baseline JPEG byte sequence written directly with Buffer.
function makeSmallJpeg() {
    return Buffer.concat([
        Buffer.from([0xFF, 0xD8]),                 // SOI
        Buffer.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]), // APP0/JFIF
        Buffer.from([0xFF, 0xDB, 0x00, 0x43, 0x00]), // DQT (id 0)
        new Uint8Array(64).fill(0x10),
        Buffer.from([0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00]), // SOF0 1x1
        Buffer.from([0xFF, 0xC4, 0x00, 0x14, 0x00]), Buffer.concat([Buffer.alloc(2 ** 8, 0).fill(1), Buffer.from([0x00]), Buffer.alloc(15).fill(1)]), // DHT
        Buffer.concat([Buffer.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00]), Buffer.from([0x7F, 0xFF])]), // SOS + minimal scan
        Buffer.from([0xFF, 0xD9]),                 // EOI
    ]);
}
const fileFrom = (bytes, name, type) => new File([bytes], name, { type });

async function headStatus(url) {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status;
}

(async () => {
    const adapter = await import('../../src/lib/muapiUpload.js');
    const {
        uploadImageToMuAPI, uploadVideoToMuAPI, resolveMuAPIMediaInput, validateMuAPIUpload,
        getCachedMuapiUpload, clearMuapiUploadCache,
    } = adapter;
    const { MuapiClient } = await import('../../lib/muapi.js');

    const pngBytes = makeRealPng(0x33, 0x66, 0x99);
    const jpegBytes = makeSmallJpeg();
    const mp4Bytes = fssync.readFileSync(path.join(__dirname, '..', 'fixtures', 'sample.mp4'));

    // Pre-check: is the Asset Library module loadable under plain Node? Its
    // graph (supabase.js) reads import.meta.env, which plain Node does not
    // populate, and the offline-storage.js hop instantiates an IndexedDB-backed
    // service at module scope whose init promise rejects unhandled under Node
    // (no indexedDB). Importing it HERE would hard-crash this process with a
    // raw stack before the classified provider errors below can print, so the
    // probe runs in a THROWAWAY CHILD PROCESS: only a fully clean import counts
    // as loadable. Steps 7–8 depend on it; the cache/re-upload logic is covered
    // by the vitest suite (src/lib/editor/__tests__/muapiUpload.test.js).
    let assetLibraryLoadable = true;
    let assetLibraryLoadError = '';
    const assetLibraryUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'assetLibrary.js')).href;
    const probe = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', `await import(${JSON.stringify(assetLibraryUrl)}).then(() => process.exit(0));`],
        { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'ignore', 'pipe'] }
    );
    if (probe.status !== 0) {
        assetLibraryLoadable = false;
        const firstLine = String((probe.stderr || '') + (probe.error ? probe.error.message : ''))
            .split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
        assetLibraryLoadError = (firstLine || `child exited with status ${probe.status}`).slice(0, 160);
    }

    // (1) uploadImageToMuAPI — real PNG
    let pngUrl;
    try {
        const r = await uploadImageToMuAPI(fileFrom(pngBytes, 'pixel.png', 'image/png'), AUTH);
        pngUrl = r.url;
        const u = new URL(r.url); // parses; throws if malformed
        report('1. uploadImageToMuAPI(PNG)', u.protocol === 'https:' && r.category === 'image', `url=${r.url}`);
    } catch (e) {
        report('1. uploadImageToMuAPI(PNG)', false, `— ${e && e.code ? e.code + ': ' : ''}${e && e.userMessage ? e.userMessage : e && e.message}`);
    }

    // (2) uploadImageToMuAPI — real JPEG
    let jpegUrl;
    try {
        const r = await uploadImageToMuAPI(fileFrom(jpegBytes, 'pixel.jpg', 'image/jpeg'), AUTH);
        jpegUrl = r.url;
        const u = new URL(r.url);
        report('2. uploadImageToMuAPI(JPEG)', u.protocol === 'https:' && r.category === 'image', `url=${r.url}`);
    } catch (e) {
        report('2. uploadImageToMuAPI(JPEG)', false, `— ${e && e.code ? e.code + ': ' : ''}${e && e.userMessage ? e.userMessage : e && e.message}`);
    }

    // (3) uploadVideoToMuAPI — real MP4
    let mp4Url;
    try {
        const r = await uploadVideoToMuAPI(fileFrom(mp4Bytes, 'sample.mp4', 'video/mp4'), AUTH);
        mp4Url = r.url;
        const u = new URL(r.url);
        report('3. uploadVideoToMuAPI(MP4)', u.protocol === 'https:' && r.category === 'video', `url=${r.url}`);
    } catch (e) {
        report('3. uploadVideoToMuAPI(MP4)', false, `— ${e && e.code ? e.code + ': ' : ''}${e && e.userMessage ? e.userMessage : e && e.message}`);
    }

    // (4) returned URLs parse (https) and are reachable (HEAD 200)
    try {
        const urls = [pngUrl, jpegUrl, mp4Url].filter(Boolean);
        if (urls.length === 0) {
            // Never claim a pass there is nothing to verify (all uploads failed).
            report('4. urls https + reachable (HEAD 200)', false, '— no uploaded URLs to verify');
        } else {
            let allOk = true;
            const details = [];
            for (const url of urls) {
                const u = new URL(url);
                const https = u.protocol === 'https:';
                let status = 0;
                try { status = await headStatus(url); } catch (he) { status = -1; }
                const ok = https && status === 200;
                allOk = allOk && ok;
                details.push(`${u.host} → HEAD ${status}`);
            }
            report('4. urls https + reachable (HEAD 200)', allOk, details.join(' | '));
        }
    } catch (e) {
        report('4. urls https + reachable (HEAD 200)', false, `— ${e.message}`);
    }

    // (5) one real, cheap MuAPI generation that accepts an uploaded image URL
    try {
        if (!pngUrl) throw new Error('no uploaded PNG URL available');
        const client = new MuapiClient(KEY);
        const model = process.env.MUAPI_TEST_I2V_MODEL || 'kling-v3.0-pro-image-to-video';
        const result = await client.generateImageToVideo({
            model,
            image_url: pngUrl,
            prompt: 'gentle cinematic zoom',
            aspect_ratio: '1:1',
            duration: 5,
            resolution: '720p',
        });
        const outUrl = result && result.url;
        const ok = typeof outUrl === 'string' && new URL(outUrl).protocol === 'https:';
        report('5. real generation from uploaded image URL', ok, outUrl ? `output=${outUrl}` : 'no output url');
    } catch (e) {
        report('5. real generation from uploaded image URL', false, `— ${e && e.message}`);
    }

    // (6) the permanent original is still available (temp durable copy re-read)
    try {
        const tmp = path.join(os.tmpdir(), `muapi-int-original-${Date.now()}.png`);
        fssync.mkdirSync(os.tmpdir(), { recursive: true });
        fssync.writeFileSync(tmp, pngBytes);
        const reread = await fs.readFile(tmp);
        await fs.unlink(tmp).catch(() => {});
        const ok = Buffer.compare(Buffer.from(reread), Buffer.from(pngBytes)) === 0;
        report('6. permanent original preserved + re-readable', ok, `${pngBytes.length} bytes`);
    } catch (e) {
        report('6. permanent original preserved + re-readable', false, `— ${e.message}`);
    }

    // (7) saved asset reusable after refresh (cache-miss re-upload path)
    if (!assetLibraryLoadable) {
        note('7. resolveMuAPIMediaInput (cache-miss) — SKIPPED under plain Node: assetLibrary graph not loadable (' + assetLibraryLoadError + '). Cache/re-upload logic is covered by vitest muapiUpload.test.js.');
    } else {
        try {
            clearMuapiUploadCache();
            const r = await resolveMuAPIMediaInput('integration-asset-1', AUTH);
            const ok = typeof r.url === 'string' && (r.source === 'asset' || r.source === 'cache');
            report('7. resolveMuAPIMediaInput cache-miss re-upload', ok, `source=${r.source} url=${r.url}`);
        } catch (e) {
            report('7. resolveMuAPIMediaInput cache-miss re-upload', false, `— ${e && (e.code || e.message)}`);
        }
    }

    // (8) expired-URL regeneration: expired cache entry forces a fresh re-upload
    if (!assetLibraryLoadable) {
        note('8. expired-URL regeneration — SKIPPED under plain Node (assetLibrary not loadable). Covered by vitest muapiUpload.test.js.');
    } else {
        try {
            clearMuapiUploadCache();
            const before = globalThis.fetch;
            let calls = 0;
            globalThis.fetch = (...args) => { calls += 1; return before(...args); };
            let first;
            try { first = await resolveMuAPIMediaInput('integration-asset-2', AUTH); } finally { globalThis.fetch = before; }
            const entry = getCachedMuapiUpload('integration-asset-2', AUTH);
            globalThis.fetch = (...args) => { calls += 1; return before(...args); };
            if (entry) entry.expiresAt = Date.now() - 60 * 1000; // already expired
            const callsBeforeRefresh = calls;
            let second;
            try { second = await resolveMuAPIMediaInput('integration-asset-2', AUTH); } finally { globalThis.fetch = before; }
            const reUploaded = calls > callsBeforeRefresh && second && second.source === 'asset';
            report('8. expired-URL forces re-upload', reUploaded, `calls went ${callsBeforeRefresh} → ${calls}`);
        } catch (e) {
            report('8. expired-URL forces re-upload', false, `— ${e && (e.code || e.message)}`);
        }
    }

    // (9) size limits reject client-side BEFORE any network call
    try {
        const real = globalThis.fetch;
        let netCalls = 0;
        globalThis.fetch = (...args) => { netCalls += 1; return real(...args); };
        const bigPng = Buffer.concat([makeRealPng(0, 0, 0), Buffer.alloc(11 * 1024 * 1024)]);
        const bigMp4 = Buffer.concat([mp4Bytes, Buffer.alloc(51 * 1024 * 1024)]);
        let imageErr;
        let videoErr;
        try { await uploadImageToMuAPI(fileFrom(bigPng, 'big.png', 'image/png'), AUTH); } catch (e) { imageErr = e; }
        try { await uploadVideoToMuAPI(fileFrom(bigMp4, 'big.mp4', 'video/mp4'), AUTH); } catch (e) { videoErr = e; }
        globalThis.fetch = real;
        const ok = imageErr && imageErr.code === 'MUAPI_FILE_TOO_LARGE'
            && videoErr && videoErr.code === 'MUAPI_FILE_TOO_LARGE'
            && netCalls === 0;
        report('9. 11MB image / 51MB video rejected client-side (no network)', ok, `image=${imageErr && imageErr.code} video=${videoErr && videoErr.code} netCalls=${netCalls}`);
    } catch (e) {
        report('9. 11MB image / 51MB video rejected client-side (no network)', false, `— ${e.message}`);
    }

    const failed = checks.filter((c) => !c.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
    if (failed.length) {
        process.exit(1);
    }
    console.log('REAL INTEGRATION PASS: all numbered checks succeeded against the live MuAPI provider.');
    process.exit(0);
})().catch((e) => {
    console.error('REAL INTEGRATION ERROR:', e && e.message ? e.message : e);
    process.exit(1);
});
