/**
 * PROTECTED-APPLICATION UPLOAD SAFETY BASELINE — Task 1 of the unified
 * upload-pipeline repair (branch: fix/unified-media-upload-pipeline).
 *
 * Purpose: prove the three PROTECTED applications never change because of the
 * upload repairs in Tasks 2-5, and fail loudly if they do.
 *
 *   Protected applications:
 *     1. Timeline Studio / Timeline Editor
 *     2. CineGen and all CineGen-related components
 *     3. Chat, including Chat attachments and upload functionality
 *
 * Why this test exists: the protected apps share upload modules with the
 * studios being repaired (src/lib/muapi.js, src/lib/uploadService.js,
 * src/lib/editor/upload.js, src/lib/editor/uploadPipeline.js,
 * src/lib/supabase.js, src/lib/hybrid-supabase.js,
 * src/lib/editor/uploadLimits.js, src/lib/editor/validateFile.js). If a later
 * task changes a shared module's exported signature, or re-routes a protected
 * app's upload call site, the protected app breaks silently. This guard turns
 * that into a loud test failure.
 *
 * Design (non-modifying — this test never writes to any source file):
 *   1. SHARED CONTRACT SIGNATURES — every shared upload entry point's exact
 *      exported signature and routing-relevant default behaviour is asserted
 *      against the live source text.
 *   2. PROTECTED IMPORT SURFACE — the exact import statements through which
 *      each protected app reaches the shared upload modules are asserted.
 *   3. PROTECTED FILE INTEGRITY — a sha256 baseline over every protected
 *      application file (code + its tests). Any edit, however small, fails.
 *   4. BEHAVIOUR CONTRACTS — live behavioural assertions that a Timeline
 *      upload still resolves through muapi.uploadFile via processFileUpload,
 *      that a Chat attachment upload still goes through uploadService's
 *      uploadFileToStorage into the `uploads` bucket, that Chat generation
 *      still streams through muapi.generateTextStream, and that CineGen
 *      generation/Element upload still resolve through the same entry points.
 *   5. SEMANTIC INTEGRITY — for files whose byte hash had to be re-recorded
 *      because of an INTENTIONAL, approved edit, real assertions that survive
 *      formatting and inline edits but still catch the dangerous ones: a
 *      browser-exposed provider key, a re-route around the proxy, or a shrunken
 *      public API. A byte hash alone cannot tell an approved edit from an
 *      accidental one, so these carry the weight those hashes gave up.
 *
 * If a change to a protected app or a shared contract is intentional and
 * approved, update this baseline deliberately (re-record the sha256 values and
 * signatures) — do not weaken or delete the assertions. When you re-record a
 * hash for an intentional edit, ALSO add the semantic assertions for that file
 * in section 5, so the byte relaxation is paid for.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Module mocks (network/storage layers only — never the public contract of the
// modules under test). These make the behaviour contracts deterministic.
// ---------------------------------------------------------------------------

vi.mock('../lib/muapi.js', () => {
  const uploadFile = vi.fn(async (file: any) => `https://cdn.muapi.ai/${file?.name ?? 'file'}`);
  const generateImage = vi.fn(async () => ({ url: 'https://cdn.muapi.ai/generated.png' }));
  const generateTextStream = vi.fn(async (params: any) => {
    params?.onDelta?.('hello');
    params?.onDone?.();
    return { text: 'hello' };
  });
  const generateText = vi.fn(async () => ({ text: 'hello' }));
  class MuapiClient {
    uploadFile = uploadFile;
    generateImage = generateImage;
    generateTextStream = generateTextStream;
    generateText = generateText;
  }
  const muapi = {
    uploadFile,
    generateImage,
    generateTextStream,
    generateText,
    generateVideo: vi.fn(),
    generateAudio: vi.fn(),
    generateVideoEffect: vi.fn(),
    listAssets: vi.fn(async () => []),
  };
  return {
    muapi,
    MuapiClient,
    default: MuapiClient,
    submitOnly: vi.fn(),
    checkStatus: vi.fn(),
    downloadResult: vi.fn(),
  };
});

vi.mock('../lib/supabase.js', () => {
  const upload = vi.fn(async () => ({ data: { path: 'object-path' }, error: null }));
  const getPublicUrl = vi.fn((p: string) => ({
    data: { publicUrl: `https://supabase.example.com/storage/${p}` },
    error: null,
  }));
  const from = vi.fn(() => ({ upload, getPublicUrl }));
  return {
    supabase: { storage: { from } },
    isSupabaseConfigured: () => true,
    getSupabaseUrl: () => 'https://supabase.example.com',
    getSupabaseAnonKey: () => 'anon-key',
  };
});

vi.mock('../lib/hybrid-supabase.js', () => ({
  uploadFileToStorage: vi.fn(async (file: any) => `https://supabase.example.com/${file?.name ?? 'file'}`),
  supabase: { storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn() })) } },
  hybridSupabase: {},
  isSupabaseConfigured: () => true,
}));

// The studio media bridge (src/lib/muapiStudioMedia.js) is the APPROVED upload
// path for studio components: ElementImageUpload calls
// ingestStudioUpload(file, { studioId }) and the bridge validates, stores a
// permanent Asset Library row, then uploads through the shared adapter
// (src/lib/muapiUpload.js → official MuAPI File Upload API). Mocking here
// keeps the behaviour contract deterministic without touching the network;
// the delegation itself is pinned by source-text assertions below.
vi.mock('../lib/muapiStudioMedia.js', () => ({
  getMuapiAuthContext: vi.fn(async () => ({
    userId: 'user-a',
    workspaceId: 'ws-1',
    muapiKey: 'test-muapi-key',
  })),
  ingestStudioUpload: vi.fn(async (file: any) => ({
    assetId: `asset-${file?.name ?? 'file'}`,
    url: `https://storage.test.local/${file?.name ?? 'file'}`,
    path: `user-a/${file?.name ?? 'file'}`,
    name: file?.name ?? 'file',
    type: file?.type ?? 'image/png',
    category: 'image',
    mime: file?.type ?? 'image/png',
    sizeBytes: file?.size ?? 0,
    reused: false,
    muapiUrl: `https://api.muapi.ai/tmp/${file?.name ?? 'file'}`,
  })),
  resolveMuapiMediaRef: vi.fn(async (ref: any) =>
    typeof ref === 'string' ? ref : (ref?.url ?? null),
  ),
  resolveMuapiMediaRefs: vi.fn(async (refs: any) =>
    (Array.isArray(refs) ? refs : [])
      .map((r: any) => (typeof r === 'string' ? r : r?.url))
      .filter(Boolean),
  ),
  resolvePersonalizationMediaRef: vi.fn(async (el: any) => el?.src || el?.url || null),
  describeMuapiUploadError: vi.fn(async (error: any) => error?.message || 'Upload failed.'),
  createStudioInFlightGuard: vi.fn(() => ({
    isBusy: () => false,
    keys: () => [],
    run: async (_key: string, fn: () => Promise<any>) => ({ skipped: false, value: await fn() }),
  })),
}));

vi.mock('../lib/editor/validateFile.js', () => ({
  validateFile: vi.fn(async (file: any) => ({
    valid: true,
    type: (file?.type || '').startsWith('video/') ? 'video' : 'image',
    config: { maxSize: 50 * 1024 * 1024 },
    detected: null,
    source: 'mock',
  })),
  validateFileSync: vi.fn(() => ({ valid: true, type: 'image' })),
  categorize: vi.fn(() => ({ category: 'image', config: {} })),
  formatFileSize: vi.fn(() => '1.0 MB'),
  FILE_TYPE_CONFIG: {},
}));

vi.mock('../lib/editor/metadataExtractor.js', () => ({
  extractMetadata: vi.fn(async () => ({
    duration: 2,
    width: 640,
    height: 480,
    fps: 30,
    codec: 'h264',
    bitrate: 1000,
    sampleRate: 0,
    channels: 0,
    container: 'mp4',
    rotation: 0,
    orientation: 1,
    camera: null,
    gps: null,
    tags: {},
    waveform: null,
    thumbnail: null,
  })),
  generateThumbnail: vi.fn(async () => null),
  extractWaveform: vi.fn(async () => null),
}));

vi.mock('../lib/editor/persistence.js', () => ({
  saveProject: vi.fn(async () => ({ success: true })),
  loadProject: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// Modules under test (public entry points)
// ---------------------------------------------------------------------------

import { muapi } from '../lib/muapi.js';
import { supabase } from '../lib/supabase.js';
import { uploadFileToStorage } from '../lib/uploadService.js';
import { processFileUpload } from '../lib/editor/uploadPipeline.js';
import { ingestStudioUpload } from '../lib/muapiStudioMedia.js';
import { useAttachmentState } from '../hooks/useAttachmentState.js';
import { sendChatMessage } from '../lib/chatApi.js';
import { cinegen } from '../lib/cinegen.js';
import { ElementImageUpload } from '../components/elements/element-image-upload.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Test file lives in src/test/, so the repo root is two levels up. All
// recorded paths below are repo-root-relative.
const ROOT = resolve(__dirname, '../..');

function readSource(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function sha256(rel: string): string {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    expect.fail(
      `PROTECTED FILE DELETED: ${rel} is expected to exist for the byte-integrity baseline but was not found. Protected applications (Timeline Studio/Timeline Editor, CineGen, Chat) must not be removed by the upload-pipeline repair. If deleting this file was intentional and approved, remove its entry from PROTECTED_BASELINE in src/test/protected-upload-baseline.test.ts deliberately.`,
    );
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// Minimal React renderer (the repo has no @testing-library/dom installed, so
// the guard renders through react-dom/client directly). `act` comes from
// React 19's public API.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ root: any; container: HTMLElement }> = [];

async function renderComponent(element: any): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  await act(async () => {
    root.render(element);
  });
  return container;
}

async function renderHook<T>(useHook: () => T): Promise<{ current: T }> {
  const captured: { current: T } = { current: undefined as unknown as T };
  function Probe() {
    captured.current = useHook();
    return null;
  }
  await renderComponent(createElement(Probe));
  return captured;
}

/** Dispatch a native bubbling event with extra properties (e.g. dataTransfer). */
function dispatchNativeEvent(el: Element, type: string, props: Record<string, unknown>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props);
  el.dispatchEvent(event);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => {
    for (const { root } of mountedRoots.splice(0)) {
      root.unmount();
    }
  });
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// 1. SHARED UPLOAD CONTRACT SIGNATURES
// ---------------------------------------------------------------------------

describe('shared upload entry points — exported signatures and routing defaults', () => {
  const contracts: Array<{ module: string; entry: string; expectations: string[] }> = [
    {
      module: 'src/lib/muapi.js',
      entry: 'MuapiClient#uploadFile / muapi singleton / MuapiClient class',
      expectations: [
        'export class MuapiClient {',
        'export default MuapiClient;',
        'export const muapi = new MuapiClient();',
        // Exact signature: (file, { signal, onProgress })
        'async uploadFile(file, { signal, onProgress } = {})',
        // Temporary-asset routing: uploadFile must delegate transport to the
        // single shared adapter (which owns the upload_file proxy endpoint).
        "import { validateMuAPIUpload, uploadImageToMuAPI, uploadVideoToMuAPI, uploadFileToMuapi } from './muapiUpload.js';",
        // Architectural constraint: 401/402/403/413/415/422 (and other
        // non-retryable adapter errors) must never be silently bypassed onto
        // the Supabase fallback. _toLegacyUploadError marks only retryable
        // provider failures fallbackToStorage, so auth (401/403), credit
        // (402), oversize (413), and format (415/422) errors are surfaced
        // instead of being swapped for a storage URL.
        'out.fallbackToStorage = retryable;',
      ],
    },
    {
      module: 'src/lib/uploadService.js',
      entry: 'UploadError / resolveSupabaseBucket / validateUploadFile / uploadFileToSupabase / uploadFileToStorage',
      expectations: [
        'export class UploadError extends Error {',
        'export function resolveSupabaseBucket() {',
        "return 'uploads';",
        'export function validateUploadFile(file, overrides) {',
        'export async function uploadFileToSupabase(file, options = {}) {',
        'export async function uploadFileToStorage(file, options = {}) {',
        'return uploadFileToSupabase(file, options);',
      ],
    },
    {
      module: 'src/lib/editor/upload.js',
      entry: 'uploadMediaFile',
      expectations: [
        'export async function uploadMediaFile(file, options = {}) {',
        // Delegation to muapi.uploadFile must remain the single upload path
        'const url = await muapi.uploadFile(file);',
      ],
    },
    {
      module: 'src/lib/editor/uploadPipeline.js',
      entry: 'processFileUpload / fetchUrlAsFile / processMultipleFileUploads / validateFile re-export',
      expectations: [
        'export async function processFileUpload(file, options = {}) {',
        'export async function fetchUrlAsFile(url, filename) {',
        'export async function processMultipleFileUploads(files, options = {}) {',
        'export { validateFileImpl as validateFile };',
        // Timeline uploads must keep routing through muapi.uploadFile
        'publicUrl = await uploadWithRetry(() => muapi.uploadFile(file), opts);',
      ],
    },
    {
      module: 'src/lib/supabase.js',
      entry: 'uploadFileToStorage (MuAPI fallback target)',
      expectations: [
        'export async function uploadFileToStorage(file) {',
        ".from('uploads')",
      ],
    },
    {
      module: 'src/lib/hybrid-supabase.js',
      entry: 'uploadFileToStorage / supabase alias',
      expectations: [
        'export async function uploadFileToStorage(file) {',
        'export { hybridSupabase as supabase };',
        ".from('uploads')",
      ],
    },
    {
      module: 'src/lib/editor/uploadLimits.js',
      entry: 'UPLOAD_LIMITS / MIME / extensions / retry / timeouts / helpers',
      expectations: [
        'export const SUPABASE_PROXY_BODY_LIMIT_BYTES = 8 * 1024 * 1024;',
        'export const UPLOAD_LIMITS = {',
        'image: 10 * 1024 * 1024,',
        'video: 50 * 1024 * 1024,',
        'audio: 10 * 1024 * 1024,',
        'other: 10 * 1024 * 1024,',
        'export const UPLOAD_MIME_TYPES = {',
        'export const UPLOAD_EXTENSIONS = {',
        'export const UPLOAD_RETRY_CONFIG = {',
        'maxRetries: 2,',
        'retryableStatuses: [502, 503, 429],',
        'export const UPLOAD_TIMEOUT_MS = 60000;',
        'export const UPLOAD_LARGE_TIMEOUT_MS = 120000;',
        'export function getUploadLimit(category) {',
        'export function isAllowedMimeType(mimeType, category) {',
        'export function isAllowedExtension(extension, category) {',
        'export function categoryFromMimeType(mimeType) {',
      ],
    },
    {
      module: 'src/lib/editor/validateFile.js',
      entry: 'validateFile / validateFileSync / FILE_TYPE_CONFIG / categorize / formatFileSize',
      expectations: [
        'export const FILE_TYPE_CONFIG = {',
        'export function categorize(mimeType, extension) {',
        'export function formatFileSize(bytes) {',
        'export async function validateFile(file, opts = {}) {',
        'export function validateFileSync(file) {',
      ],
    },
  ];

  for (const contract of contracts) {
    describe(`${contract.module} — ${contract.entry}`, () => {
      for (const expectation of contract.expectations) {
        it(`keeps: ${expectation}`, () => {
          const source = readSource(contract.module);
          expect(
            source,
            `Shared upload contract drift in ${contract.module}. If this change is intentional, update the Task 1 baseline guard (src/test/protected-upload-baseline.test.ts) deliberately.`,
          ).toContain(expectation);
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. PROTECTED IMPORT SURFACE
// ---------------------------------------------------------------------------

describe('protected applications — upload import surface', () => {
  // Each entry: [protected file, what it is, exact import statement that
  // binds it to a shared upload entry point].
  const importers: Array<{ file: string; app: string; imports: string[] }> = [
    {
      file: 'src/components/TimelineEditorPage.jsx',
      app: 'Timeline Studio / Timeline Editor',
      imports: [
        "import { supabase, uploadFileToStorage } from '../lib/hybrid-supabase.js';",
        "import { setupEnhancedTooltips } from '../lib/editor/dragDrop.js';",
        "import { processFileUpload } from '../lib/editor/uploadPipeline.js';",
        "import { setupUploadSources } from '../lib/editor/uploadSources.js';",
      ],
    },
    {
      file: 'src/hooks/useAttachmentState.js',
      app: 'Chat — attachments upload',
      imports: [
        "import { uploadFileToStorage } from '../lib/uploadService.js';",
      ],
    },
    {
      file: 'src/components/ChatStudio.js',
      app: 'Chat — studio entry point',
      imports: ["import { muapi } from '../lib/muapi.js';"],
    },
    {
      file: 'src/lib/chatApi.js',
      app: 'Chat — generation API',
      imports: ["import { muapi } from './muapi.js';"],
    },
    {
      file: 'src/lib/cinegen.js',
      app: 'CineGen — integration layer',
      imports: ["import { muapi } from './muapi.js';"],
    },
    {
      file: 'src/components/elements/element-image-upload.jsx',
      app: 'CineGen — Elements image upload (studio media bridge call site)',
      imports: ["import { ingestStudioUpload, describeMuapiUploadError } from '../../lib/muapiStudioMedia.js';"],
    },
    {
      file: 'src/components/create/nodes/music-prompt-node.jsx',
      app: 'CineGen — workflow node (music prompt)',
      imports: ["import { muapi } from '../../lib/muapi.js';"],
    },
    // Shared infrastructure that the protected apps depend on: these files sit
    // between the protected apps and the shared entry points.
    {
      file: 'src/lib/editor/uploadSources.js',
      app: 'Timeline Editor upload sources (delegates to uploadPipeline)',
      imports: [
        "import { processFileUpload, fetchUrlAsFile, processUrlUpload } from './uploadPipeline.js';",
      ],
    },
    {
      file: 'src/lib/editor/dragDrop.js',
      app: 'Timeline Editor drag & drop (delegates to uploadPipeline + uploadService)',
      imports: [
        "import { uploadFileToStorage } from '../lib/uploadService.js';",
        "import { processFileUpload } from './uploadPipeline.js';",
      ],
    },
    {
      file: 'src/lib/editor/mediaLibrary.js',
      app: 'Timeline Editor media library (lazy-loads uploadPipeline)',
      imports: [
        "import('./uploadPipeline.js')",
      ],
    },
    {
      file: 'src/lib/editor/aiTools.js',
      app: 'Timeline Editor AI tools (supabase.js uploadFileToStorage)',
      imports: ["import { uploadFileToStorage } from '../supabase.js';"],
    },
  ];

  for (const importer of importers) {
    for (const importLine of importer.imports) {
      it(`${importer.app}: ${importer.file} keeps "${importLine}"`, () => {
        const source = readSource(importer.file);
        expect(
          source,
          `Protected import surface drift in ${importer.file} (${importer.app}). The protected application must keep resolving uploads through the same shared entry point. If a re-route is intentional and approved, update this baseline deliberately.`,
        ).toContain(importLine);
      });
    }
  }

  it('no protected application file imports a NEW upload module outside the shared contract set', () => {
    // The protected apps may only reach upload services through the shared
    // modules guarded above. Any other specifier — static OR dynamically
    // loaded — that looks like an upload service is a red flag.
    //
    // The specifier scan recognises all three forms, in either quote style:
    //   * static:    `import ... from 'x'` / `export ... from 'x'`
    //   * dynamic:   `import('x')` (lazy-loaded upload paths)
    //   * commonjs:  `require('x')`
    // A previous revision matched only `from '...'`, so a dynamic import or a
    // require of an upload module in any file that is not byte-pinned was
    // completely invisible to this check.
    const IMPORT_SPECIFIER =
      /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
    // Every relative specifier form through which the upload call sites below
    // legitimately reach those shared modules, plus the protected Timeline
    // entry point's direct reach into uploadSources.js / dragDrop.js.
    const allowed = [
      // shared upload contract modules
      '../lib/muapi.js',
      './muapi.js',
      '../../lib/muapi.js',
      '../lib/uploadService.js',
      './uploadService.js',
      '../lib/editor/upload.js',
      './upload.js',
      '../lib/editor/uploadPipeline.js',
      './uploadPipeline.js',
      '../lib/editor/uploadLimits.js',
      './uploadLimits.js',
      '../lib/editor/validateFile.js',
      './validateFile.js',
      '../lib/supabase.js',
      './supabase.js',
      '../../supabase.js',
      '../supabase.js',
      '../lib/hybrid-supabase.js',
      './hybrid-supabase.js',
      // approved studio media bridge (muapiStudioMedia.js → muapiUpload.js →
      // official MuAPI File Upload API). Owned by the upload-pipeline repair;
      // the bridge is the CORRECT upload path for studio components (Element
      // image upload, AI Captions modal) — it validates, stores a permanent
      // Asset Library row, then uploads through the shared adapter. Any
      // component outside the bridge call-site list reaching muapiStudioMedia
      // still fails this guard.
      '../lib/muapiStudioMedia.js',
      './muapiStudioMedia.js',
      '../../lib/muapiStudioMedia.js',
      '../lib/muapiUpload.js',
      './muapiUpload.js',
      '../../lib/muapiUpload.js',
      // protected Timeline entry-point internals
      '../lib/editor/uploadSources.js',
      './uploadSources.js',
      '../lib/editor/dragDrop.js',
      './dragDrop.js',
    ];
    // Files with live upload call sites. Superset of the byte baseline: it also
    // covers non-byte-pinned upload call sites (the shared caption modal and
    // its action wrapper), so a re-route there stays visible even though those
    // files are not protected application files.
    const uploadCallSiteFiles = [
      'src/components/TimelineEditorPage.jsx',
      'src/lib/editor/dragDrop.js',
      'src/lib/editor/uploadSources.js',
      'src/lib/editor/mediaLibrary.js',
      'src/lib/editor/aiTools.js',
      'src/lib/editor/captionActions.js',
      'src/components/modals/AICaptionsModal.jsx',
      'src/components/ChatStudio.js',
      'src/components/chat/ChatStudio.jsx',
      'src/components/chat/ChatInput.jsx',
      'src/components/chat/AttachmentChips.jsx',
      'src/components/chat/AttachmentToolbar.jsx',
      'src/hooks/useAttachmentState.js',
      'src/hooks/useChat.js',
      'src/lib/chatApi.js',
      'src/lib/cinegen.js',
      'src/components/elements/element-image-upload.jsx',
      'src/components/elements/element-generate.jsx',
      'src/components/create/nodes/music-prompt-node.jsx',
    ];
    for (const file of uploadCallSiteFiles) {
      const source = readSource(file);
      for (const match of source.matchAll(IMPORT_SPECIFIER)) {
        const specifier = match[1];
        if (/(upload|muapi|supabase|storage|hybrid)/i.test(specifier)) {
          expect(
            allowed,
            `${file} reaches upload module '${specifier}' which is outside the shared upload contract set. The protected application must keep resolving uploads through the same shared entry point. If this re-route is intentional and approved, update this baseline deliberately.`,
          ).toContain(specifier);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. PROTECTED FILE INTEGRITY (sha256 baseline)
// ---------------------------------------------------------------------------

describe('protected application files — byte-for-byte integrity baseline', () => {
  // sha256 recorded at Task 1 baseline on branch
  // fix/unified-media-upload-pipeline. Any modification to a protected
  // application file (code, routes, handlers, state, UI, config, tests)
  // fails here.
  //
  // Three entries below were re-recorded deliberately for intentional,
  // reviewed edits (cinegen personalization merge; two import repairs). Four
  // further entries (ChatStudio.js, element-image-upload.jsx, ICLoraPanel.jsx,
  // dragDrop.js) were re-recorded deliberately for the release tree: the
  // recorded hashes came from PR #28's tree and never matched the release
  // tree's actual bytes (the files themselves are byte-identical to
  // origin/main). Each re-recorded file is additionally covered by the
  // SEMANTIC INTEGRITY assertions in section 5, which are what now stop a
  // dangerous edit — a byte hash cannot distinguish an approved edit from an
  // accidental one, so those files are guarded by meaning rather than by
  // bytes.
  const PROTECTED_BASELINE: Array<[string, string]> = [
    // Re-recorded deliberately: the keyboard tool shortcut stored the lowercase
    // tool id while the toolbar / mask overlay compared display labels, so the
    // shortcut appeared to do nothing. Fixed by resolving the stored token
    // through a single normaliser (`selectedToolLabel()`). No upload-pipeline
    // behaviour changed. Semantic coverage in section 5.
    ['src/components/TimelineEditorPage.jsx', '33b10e84bfe15f8b5f14c96d2e2e0de8b7e91c9b61bc420ba4f1029e9054d9a8'],
    ['src/components/ChatStudio.js', '40db1268cfde0edc4a7bffcb67c4d524cd72096bc2ead9045f37c2393fc76872'],
    ['src/components/chat/ChatStudio.jsx', '596d60a5d1b78b38c4041af4c4606ff2e13ce667ef232218dc984b3e6943f909'],
    ['src/components/chat/ChatInput.jsx', '5401123b227dab3fe16b9e6124995b34edb96d0dcd2d54a149e8165a57a18693'],
    ['src/components/chat/ChatMessage.jsx', 'b2e236103147d0fdfb59165599a5963e09878f5b28cc0992a75650d77b9e9008'],
    ['src/components/chat/ChatSidebar.jsx', '6bea82236dba0a41bbf9f5ef6ef5e58a97c2388820fd2b07f03842af89d14c49'],
    ['src/components/chat/AttachmentChips.jsx', '8731d3421f55883019a3f1e33bb9132777de9ab6ff38eeb53a335bc59d4dc104'],
    ['src/components/chat/AttachmentToolbar.jsx', '30bddd1f38b34f5d2056a5b3ebafa360e03f8858a6847a4cf69e3614f9e3e763'],
    ['src/components/chat/ModelSelector.jsx', 'db0298741d663dad799003d3c6fb7227ceaa25b30ec1e94ca3d9d7c9b2a98f87'],
    ['src/components/chat/ChatStudio.css', 'c2037cbf6e595c85926958f233bdd98d67de1d4da77cf904bf52d2041da61cf4'],
    ['src/hooks/useAttachmentState.js', '8e4bf9b95ddc0e4561a70a1688169a1e31a8d8be3481caf521123a8203f9bec2'],
    ['src/hooks/useChat.js', '0a48a4e58c7180de654c3ff9330f66b85b48b9d2635d6d56c1058dc748e16948'],
    ['src/lib/chatApi.js', '277372658b0a9b978441ae747ef32960680505575178036d5f566c2be27f9a3c'],
    ['src/lib/chatStore.js', 'bf656c016fc8f4ca01ce5aaa6dd7261a0caa4a8693943335f47ca2b0afd86b77'],
    ['src/lib/chatPersistence.js', '2d81dd7bb1edc0298f61f111f1adc5cdf35d32eaa03e4800600852ff83e39bfe'],
    // Re-recorded deliberately after the intentional personalization
    // integration point (Task 2 of the personalization wiring): cinegen now
    // merges `resolveForCineGen()` into generateElement / the extend edit
    // tool with studio-supplied values always winning. No upload-pipeline
    // behaviour changed. See src/lib/cinegen.js `withPersonalization`.
    // The byte hash is the accepted new baseline for that approved edit; the
    // real guard now lives in the semantic assertions in section 5.
    ['src/lib/cinegen.js', '1a96e9fc4e7d0d17ba1c9cce9b2c1c2e539d3cf54fb0107c444c62dc9c2df531'],
    ['src/lib/cinegenIntegration.js', 'd73459062a6ff89b78b3196a7fc90c140ff491c1ffeafc18f28769d24cec706d'],
    ['src/modules/CineGen/src/layout/CineGenLayout.tsx', 'b3b232c358d01931e066ddf5d779a80a7280de70a13c8ab6c72c93b31def9e3a'],
    ['src/components/elements/element-card.jsx', 'd6bcaa6ec593761739b590a6370241f280ef7fda6e30354eb07da03c6e779bf1'],
    ['src/components/elements/element-generate.jsx', '7fc3ab1fa298a640f20070f70f93c17fcf8fe9289523a343cd6cc4bb6c799525'],
    ['src/components/elements/element-image-upload.jsx', '432a0fc06205a4947069792b33378b86f3888ad1489ae905c2d65109aa2264f4'],
    ['src/components/elements/element-modal.jsx', '47bfd626878bf6851b8f156ad1fdfe94216e252a027c55d841b50957b81a5948'],
    ['src/components/elements/elements-tab.jsx', 'aa69f0f4b9568c61de475b385738d3b7a273bcf9dd2fdd733b8b01c0590b5864'],
    ['src/components/RetakePanel.jsx', '56a4a967fb1d99ee84e1e14613bf803db97edb20f9dad5dc51e56ba0ce89c69f'],
    ['src/components/ICLoraPanel.jsx', '8fb03a11d0d44efe3155d61fc985406732a58edd07a8c09b836984eaab2deb5b'],
    ['src/components/modals/ExtendModal.jsx', '858fab83c74da4b39551b54099d355c38994bc0c170c4469e0341a590186f180'],
    ['src/components/modals/FillGapModal.jsx', 'a54bf8adc5ecf4288d467b435bb4b39a12f8fb40f06fbfca9c7219a9170e1cb6'],
    ['src/components/modals/MusicGenerationModal.jsx', 'a4c551e4f9eb1cd39002a20db266fd54a949f9af29821a094e8e8113ea8d3a72'],
    // Re-recorded deliberately after commit dfd5fb3e6 repaired a broken
    // relative import in this file (`../cinegenIntegration.js` →
    // `../../lib/cinegenIntegration.js`) so the timeline AI tool resolves
    // again. No upload-pipeline behaviour changed. Semantic coverage in
    // section 5.
    ['src/components/timeline/AIChatPanel.js', '78c426c7d1ee9006a57abd37613b8e24b66dcdc3ccfb9d750a6a07a87f4aa575'],
    ['src/components/create/nodes/music-prompt-node.jsx', '466215193c99448ae2c2b52ae63da76e57cca7735157bbdab87ad508ae207089'],
    // Timeline Editor upload internals. These hold live protected upload call
    // sites (dragDrop.js:172/:229 Supabase-direct uploadFileToStorage and
    // :1559 processFileUpload; uploadSources.js:73/:182/:198 processFileUpload;
    // mediaLibrary.js:968 processFileUpload; aiTools.js:318 uploadFileToStorage
    // from src/lib/supabase.js), so they are pinned byte-for-byte — not merely
    // through their import statements — to catch an in-body re-route.
    ['src/lib/editor/dragDrop.js', '548e957727fb80e478cea90f89988845088a010f39d778fd9aa5e3ab54eb2d50'],
    // Re-recorded deliberately after commit dfd5fb3e6 repaired a broken
    // relative import in this file (`../mediaLibrary.js` →
    // `./mediaLibrary.js`). No upload-pipeline behaviour changed. Semantic
    // coverage in section 5.
    ['src/lib/editor/uploadSources.js', '8518c38c4bb2da9c28e7a1a0a99111c54625e6c0dbce0234a53f4cf2012b78b0'],
    ['src/lib/editor/mediaLibrary.js', '32caa774b2ee2e19fe849fa18fc4b3c03d065e9ee132e89a4355822d2d49ed84'],
    ['src/lib/editor/aiTools.js', '3bb112b66ca30009f467353a22dc452fdf57bf480e5c067339c9178630e1ea19'],
    // NEW entries — Timeline Editor internals that carry no upload call site
    // but are core to the protected Timeline Editor, and whose paired suites
    // were already byte-pinned below. Neither file has been touched by this
    // branch, so these are genuine (not re-recorded) byte-stability guards.
    // `timelineHistory` is the undo/redo engine the editor's state contract
    // depends on; `timelineRenderer` draws every track/clip the user sees.
    ['src/lib/editor/timelineHistory.js', '8924274638c1cac78a829d80b18b0e4a1ba86d50e5a4d7f7ef738cec73a790f5'],
    ['src/lib/editor/timelineRenderer.js', '67b68f369eafe1b309fd26e959c62690714889d028fe8bbc7c7f5de9479446d9'],
    // Protected applications' own tests must not change either.
    ['src/components/elements/__tests__/elements.test.jsx', '8167e85942ece098065e0a55ec8fa44867d7376d21c22dbb3e9ddbd82881dbda'],
    ['src/lib/__tests__/elements-helpers.test.js', '3987f6642fbfdfe7a2d50e2d82d3bbc0bea7ec0da11983dad4e0d1c6f64d75d1'],
    ['src/test/timeline-state.test.js', '6543bd1616461b855647d40c55d81e463a0d9f674254a9f5e001d30312926551'],
    ['src/test/timeline-playback.test.js', '8dfdaafbc28d30843fdb785dd79655c41eb60cda71de6a76754c1fbbcae86f4d'],
    ['src/test/timeline-utils.test.js', '44a00a1a72de5e624cef09966e31771007494aa51ddb2195d0e450c2d2957926'],
    ['src/test/timeline-events.test.js', '61b564ebef039386ab61fac5560c20155dcce4ea54689f83590af39c7802446f'],
    ['src/test/timeline-component.test.js', '92a872bb2f6f8f57af333e2ca0073beb4c9eca628aece16fbd7ad2187de6ee66'],
    ['src/test/timeline-renderer.test.js', '835a50e065ddf4cd8a0e959089b1f4a3ddf0b4f008cc843a8d496d350bf065ef'],
    ['src/test/timeline-editor-core-integration.test.js', '9cf93afd7c9012b23eeb503064571a10158b6fc9a305fa6c5583e48a422c2ce6'],
    ['src/test/unified-timeline-editor-phase4-integration.test.js', '9af330c79e4b7cc6becc85696811c4f9b207cae5bb5744349de05a58af9c6345'],
    ['src/lib/editor/__tests__/timeline-tools.test.js', 'd43028896d47920ed744f3254c60113f73a6fdb0286151ec172020088750364d'],
    ['src/lib/editor/__tests__/timeline-bridge.test.js', '5ae98e688e25b7ff8763338560e7e288a2fcbe9dd230f79b5dd79cad84c98516'],
    ['src/lib/editor/__tests__/timeline-bridge-integration.test.js', '25f10a86b2be87ab490c2a3741d624dc0dd5f69ae1ef0f8d494a2bd835767d53'],
    ['src/lib/editor/__tests__/timeline-history.test.js', '759833d6aeb60fc4e0142080d6c613ae915476e6266b7cb2763f75079893deb6'],
    ['src/lib/editor/__tests__/timeline-operations.test.js', '2cf48c06362a441f6005b49b9b75047f12666e407fb583e2034e62ba28cdc4df'],
    ['src/lib/editor/__tests__/timeline-state-multitab.test.js', 'b0df5878f31b1efd9879d40736fbfd28b7eebc197394a30d33ece3df95b403af'],
    ['src/lib/editor/__tests__/timeline-track-controls.test.js', '91925a63b3deb493a8c0ae2c03ce787f70646be810b4b57aa4251fbd6d5cc7d3'],
    ['src/lib/editor/__tests__/timeline-editor-mask.test.js', '591901aa5d3add68baa1c2d8b86dbbe1dafd32fb2cd4711a3700d5c3aa97eef9'],
    ['src/lib/editor/__tests__/timeline-feature-api.test.js', '29a24abc1c81fb4eb63d995eceff6d129499afb166f4744a81dccc5e9bcdbcf2'],
    ['src/lib/editor/__tests__/tool-parity.test.js', 'ee65825791b7447025949328c2017d8b8338c71d4a1cf012e0a60b3bd61f4a71'],
  ];

  it.each(PROTECTED_BASELINE)('%s matches its recorded sha256 baseline', (file, expected) => {
    expect(
      sha256(file),
      `PROTECTED FILE MODIFIED: ${file}. Protected applications (Timeline Studio/Timeline Editor, CineGen, Chat) must not be changed by the upload-pipeline repair. If this change was intentional and approved, re-record the baseline sha256 in this guard deliberately.`,
    ).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 5. SEMANTIC INTEGRITY
//
// A byte hash is an all-or-nothing guard: the moment it is re-recorded for an
// approved edit, it stops protecting the file entirely. Every file whose hash
// was deliberately re-recorded (cinegen.js, AIChatPanel.js, uploadSources.js,
// TimelineEditorPage.jsx, plus the four release-tree re-records ChatStudio.js,
// element-image-upload.jsx, ICLoraPanel.jsx, dragDrop.js) therefore gets these
// assertions instead. They are
// written to survive formatting and harmless inline edits while still failing
// on the edits that actually hurt:
//
//   * a browser-exposed provider key (`import.meta.env.VITE_*KEY|SECRET|TOKEN`)
//   * a re-route that bypasses the shared proxy / shared upload entry points
//   * a shrunken or renamed public API
//   * removal of an approved, intentional integration (personalization merge)
// ---------------------------------------------------------------------------

/** A Vite env var that inlines a credential into the client bundle. */
const BROWSER_EXPOSED_KEY = /import\.meta\.env\.VITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)/i;
/** A direct provider fetch from a protected app (must go through the proxy). */
const DIRECT_PROVIDER_FETCH = /fetch\(\s*[`'"](?:https?:\/\/)?[^`'")]*(?:api\.muapi\.ai|api\.openai\.com)/i;

const SEMANTIC_GUARDED: Array<{ file: string; app: string; exports: string[] }> = [
  {
    file: 'src/lib/cinegen.js',
    app: 'CineGen — integration layer',
    // The public API the protected CineGen behaviour contracts in section 4
    // and the Timeline editor both call.
    exports: ['generateElement', 'applyEditTool', 'getElementsForTimeline'],
  },
  {
    file: 'src/components/timeline/AIChatPanel.js',
    app: 'Timeline Studio — AI chat panel',
    exports: ['AIChatPanel'],
  },
  {
    file: 'src/lib/editor/uploadSources.js',
    app: 'Timeline Editor — upload sources',
    exports: ['setupUploadSources', 'apiUpload', 'importFromUrl', 'normalizeCloudUrl', 'wireClipboardUpload'],
  },
  {
    file: 'src/components/TimelineEditorPage.jsx',
    app: 'Timeline Studio / Timeline Editor',
    exports: ['TimelineEditorPage'],
  },
  // Re-recorded deliberately for the release tree (hashes computed against
  // #28's tree no longer match the release tree; the files themselves are
  // byte-identical to origin/main). Each gets the same three semantic guards
  // as the files above so the byte relaxation is paid for.
  {
    file: 'src/components/ChatStudio.js',
    app: 'Chat — studio entry point',
    exports: ['ChatStudio'],
  },
  {
    file: 'src/components/elements/element-image-upload.jsx',
    app: 'CineGen — Elements image upload',
    exports: ['ElementImageUpload'],
  },
  {
    file: 'src/components/ICLoraPanel.jsx',
    app: 'CineGen — IC-LoRA panel',
    exports: ['ICLoraPanel'],
  },
  {
    file: 'src/lib/editor/dragDrop.js',
    app: 'Timeline Editor — drag & drop',
    exports: ['setupEnhancedTooltips', 'uploadFile', 'processMultipleFiles'],
  },
];

describe('protected files — semantic integrity assertions', () => {
  for (const { file, app, exports } of SEMANTIC_GUARDED) {
    describe(`${file} (${app})`, () => {
      it('exposes no browser-side provider credential', () => {
        const source = readSource(file);
        expect(
          BROWSER_EXPOSED_KEY.test(source),
          `${file} references an import.meta.env.VITE_* KEY/SECRET/TOKEN variable. A provider credential must never be inlined into the browser bundle — route it through the Supabase edge function / Netlify function instead.`,
        ).toBe(false);
      });

      it('makes no direct provider call that bypasses the shared proxy', () => {
        const source = readSource(file);
        expect(
          DIRECT_PROVIDER_FETCH.test(source),
          `${file} fetches a provider endpoint directly. Protected applications must reach providers through the shared muapi proxy (src/lib/muapi.js → /functions/v1/muapi-proxy) so credentials stay server-side.`,
        ).toBe(false);
      });

      it('keeps the public entry points the protected apps depend on', () => {
        const source = readSource(file);
        for (const name of exports) {
          expect(
            source,
            `${file} no longer declares "${name}", an entry point the protected app contract depends on.`,
          ).toContain(name);
        }
      });
    });
  }

  it('cinegen.js keeps its public API surface and its personalization merge', () => {
    const source = readSource('src/lib/cinegen.js');

    // Export shape
    expect(source).toContain('export const cinegen = {');
    expect(source).toContain('export default cinegen;');
    for (const fn of ['generateElement', 'applyEditTool', 'getElementsForTimeline']) {
      expect(source, `CineGen lost the exported ${fn}() entry point`).toContain(`${fn}(`);
    }

    // The LIVE object, not just the source text — catches a renamed or
    // deleted method even if the source still mentions the name in a comment.
    for (const fn of ['generateElement', 'applyEditTool', 'getElementsForTimeline']) {
      expect(typeof (cinegen as any)[fn], `cinegen.${fn} is not a function`).toBe('function');
    }

    // Provider access still goes through the shared muapi singleton
    expect(source).toContain("import { muapi } from './muapi.js';");
    for (const call of ['muapi.generateImage(', 'muapi.generateVideo(', 'muapi.generateAudio(', 'muapi.listAssets(']) {
      expect(source, `CineGen no longer routes through ${call}`).toContain(call);
    }

    // The intentional personalization merge must stay applied (studio-supplied
    // values always win). Deleting it would silently drop personalization.
    expect(source).toContain('function withPersonalization(');
    expect(source).toContain('const merged = withPersonalization(params);');
    expect(source).toContain('await muapi.generateVideo(withPersonalization({');
  });

  it('the shared muapi proxy is still there for the protected apps to route through', () => {
    const source = readSource('src/lib/muapi.js');
    expect(source).toContain("this.proxyUrl = '/functions/v1/muapi-proxy';");
    expect(source).toContain('await fetch(this.proxyUrl');
  });

  it('AIChatPanel.js still imports the CineGen integration and exports its class', async () => {
    const source = readSource('src/components/timeline/AIChatPanel.js');
    expect(source).toContain("await import('../../lib/cinegenIntegration.js')");
    expect(source).toContain('export default class AIChatPanel {');
    expect(source).toContain('export { AIChatPanel };');

    const imported = await import('../components/timeline/AIChatPanel.js');
    expect(typeof (imported as any).default).toBe('function');
    expect(typeof (imported as any).AIChatPanel).toBe('function');
  });

  it('uploadSources.js still imports the shared upload pipeline and exports its API', async () => {
    const source = readSource('src/lib/editor/uploadSources.js');
    expect(source).toContain(
      "import { processFileUpload, fetchUrlAsFile, processUrlUpload } from './uploadPipeline.js';",
    );
    for (const fn of ['setupUploadSources', 'apiUpload', 'importFromUrl', 'normalizeCloudUrl', 'wireClipboardUpload']) {
      expect(source, `uploadSources lost the exported ${fn}() entry point`).toMatch(
        new RegExp(`export (?:async )?function ${fn}\\(`),
      );
    }

    // The api fallback endpoint is relative — it must not carry a provider host.
    expect(source).not.toMatch(DIRECT_PROVIDER_FETCH);

    const imported = await import('../lib/editor/uploadSources.js');
    for (const fn of ['setupUploadSources', 'apiUpload', 'importFromUrl', 'normalizeCloudUrl', 'wireClipboardUpload']) {
      expect(typeof (imported as any)[fn], `uploadSources.${fn} is not a function`).toBe('function');
    }
  });

  it('TimelineEditorPage.jsx still exports its page factory and wires the shared upload entry points', () => {
    const source = readSource('src/components/TimelineEditorPage.jsx');
    expect(source).toContain('export function TimelineEditorPage()');
    // The keyboard tool shortcut must keep writing toolMap's value verbatim —
    // src/lib/editor/__tests__/timeline-editor-mask.test.js pins this line.
    expect(source).toContain('state.selectedTool = toolMap[toolKey]');
  });

  it('ChatStudio.js still routes generation through the shared muapi singleton', () => {
    // Re-recorded file: the byte hash alone no longer protects the Chat
    // generation path, so these assertions carry that weight.
    const source = readSource('src/components/ChatStudio.js');
    expect(source).toContain("import { muapi } from '../lib/muapi.js';");
    expect(source).toContain('export function ChatStudio()');
    expect(source).toContain('muapi.generateText({');
    // Must not bypass the proxy with a direct provider fetch or a new upload
    // module outside the shared contract set.
    expect(source).not.toMatch(DIRECT_PROVIDER_FETCH);
    expect(source).not.toContain('muapiStudioMedia');
    expect(source).not.toContain('ingestStudioUpload');
  });

  it('element-image-upload.jsx keeps its bridge delegation and public entry point', () => {
    // Re-recorded file: the byte hash alone no longer protects the Element
    // upload path. (The section 4 behaviour contract additionally proves the
    // live delegation end-to-end through the mocked bridge.)
    const source = readSource('src/components/elements/element-image-upload.jsx');
    expect(source).toContain('export function ElementImageUpload(');
    expect(source).toContain(
      "import { ingestStudioUpload, describeMuapiUploadError } from '../../lib/muapiStudioMedia.js';",
    );
    expect(source).toContain("await ingestStudioUpload(file, { studioId: 'element-library' })");
    expect(source).toContain('await describeMuapiUploadError(err)');
    // Must not re-implement an upload transport or route around the bridge.
    expect(source).not.toContain('MuapiClient');
    expect(source).not.toMatch(DIRECT_PROVIDER_FETCH);
  });

  it('ICLoraPanel.jsx still applies through cinegen and exports its panel', () => {
    // Re-recorded file: the byte hash alone no longer protects the CineGen
    // LoRA apply path.
    const source = readSource('src/components/ICLoraPanel.jsx');
    expect(source).toContain('export function ICLoraPanel(');
    expect(source).toContain('export default ICLoraPanel;');
    expect(source).toContain("import { cinegen } from '../lib/cinegen.js';");
    expect(source).toContain('cinegen.applyEditTool(');
    expect(source).not.toMatch(DIRECT_PROVIDER_FETCH);
  });

  it('dragDrop.js keeps its shared upload entry points and live call sites', () => {
    // Re-recorded file: the byte hash alone no longer protects the Timeline
    // drag-and-drop upload call sites (Supabase-direct uploadFileToStorage at
    // :172/:229 and processFileUpload at :1559).
    const source = readSource('src/lib/editor/dragDrop.js');
    expect(source).toContain("import { uploadFileToStorage } from '../lib/uploadService.js';");
    expect(source).toContain("import { processFileUpload } from './uploadPipeline.js';");
    expect(source).toContain('await uploadFileToStorage(file)');
    expect(source).toContain('await processFileUpload(file,');
    expect(source).toContain('export function setupEnhancedTooltips()');
    // Must not bypass the shared entry points with a direct provider fetch or
    // a new upload module outside the shared contract set.
    expect(source).not.toMatch(DIRECT_PROVIDER_FETCH);
    expect(source).not.toContain('muapiStudioMedia');
    expect(source).not.toContain('ingestStudioUpload');
  });
});

// ---------------------------------------------------------------------------
// 4. BEHAVIOUR CONTRACTS
// ---------------------------------------------------------------------------

describe('Timeline Studio / Timeline Editor — upload behaviour contract', () => {
  it('a Timeline upload still resolves through processFileUpload → muapi.uploadFile and lands in the timeline', async () => {
    const file = new File(['video-bytes'], 'timeline-clip.mp4', { type: 'video/mp4' });
    const state: any = {
      tracks: [],
      assets: [],
      mediaLibrary: [],
      timelineSeconds: 60,
    };

    const result = await processFileUpload(file, {
      state,
      save: false,
      thumbnail: false,
      undoSnapshot: false,
    });

    // Same entry point: muapi.uploadFile received the file
    expect(muapi.uploadFile).toHaveBeenCalledTimes(1);
    expect(muapi.uploadFile).toHaveBeenCalledWith(file);
    // ...and the public URL it returned is the asset URL
    expect(result.success).toBe(true);
    expect(result.asset.url).toBe('https://cdn.muapi.ai/timeline-clip.mp4');
    // The asset is inserted into the timeline state exactly as before
    const inserted = (state.tracks || []).some((t: any) =>
      (t.items || []).some((i: any) => i.assetId === result.asset.id && i.src === result.asset.url),
    );
    expect(inserted).toBe(true);
    expect(state.assets.some((a: any) => a.id === result.asset.id)).toBe(true);
    expect(state.mediaLibrary.some((m: any) => m.url === result.asset.url)).toBe(true);
  });

  it('a Timeline upload failure keeps the same error contract (success:false + status preserved)', async () => {
    const file = new File(['video-bytes'], 'timeline-clip.mp4', { type: 'video/mp4' });
    const boom = Object.assign(new Error('Upload failed: insufficient credits'), { status: 402 });
    (muapi.uploadFile as any).mockRejectedValueOnce(boom);
    const toasts: any[] = [];
    const result = await processFileUpload(file, {
      state: { tracks: [], assets: [], mediaLibrary: [] } as any,
      save: false,
      thumbnail: false,
      undoSnapshot: false,
      showToast: (msg: string, kind: string) => toasts.push([msg, kind]),
    });
    expect(result.success).toBe(false);
    expect(result.errorStatus).toBe(402);
    expect(toasts.length).toBe(1);
  });
});

describe('Chat — attachment upload behaviour contract', () => {
  it('uploadFileToStorage still uploads to the `uploads` bucket and returns the documented result shape', async () => {
    const file = new File(['png-bytes'], 'chat-attachment.png', { type: 'image/png' });
    const result = await uploadFileToStorage(file);

    expect(supabase.storage.from).toHaveBeenCalledWith('uploads');
    expect(result.url).toMatch(/^https:\/\/supabase\.example\.com\/storage\//);
    expect(result.url).toContain('chat-attachment.png');
    expect(result.path).toContain('anonymous/');
    expect(result.category).toBe('image');
    expect(result.mimeType).toBe('image/png');
    expect(result.extension).toBe('png');
    expect(result.size).toBe(file.size);
  });

  it('useAttachmentState.handleUpload still routes through uploadService.uploadFileToStorage and feeds the generation payload', async () => {
    const file = new File(['png-bytes'], 'chat-attachment.png', { type: 'image/png' });
    const hook = await renderHook(() => useAttachmentState());

    await act(async () => {
      await hook.current.handleUpload('image', file);
    });

    expect(hook.current.attachments.images).toHaveLength(1);
    // The Chat attachment hook stores the value returned by
    // uploadService.uploadFileToStorage on the attachment. The exact shape of
    // that value is part of the protected Chat contract and is locked in here.
    const stored = hook.current.attachments.images[0].url;
    expect(stored.url).toMatch(/^https:\/\/supabase\.example\.com\/storage\//);
    expect(stored.path).toContain('anonymous/');
    expect(hook.current.attachments.images[0].file).toBe(file);

    const payload = hook.current.toPayload();
    expect(payload.reference_images).toEqual([stored]);
    expect(payload.reference_videos).toEqual([]);
    expect(payload.first_frame_url).toBeNull();
    expect(payload.last_frame_url).toBeNull();
  });

  it('Chat generation still resolves through muapi.generateTextStream', async () => {
    const onDelta = vi.fn();
    const onDone = vi.fn();
    await sendChatMessage({
      conversationId: 'conv-1',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'gpt-5-mini',
      onDelta,
      onDone,
      onError: vi.fn(),
    });

    expect(muapi.generateTextStream).toHaveBeenCalledTimes(1);
    const params = (muapi.generateTextStream as any).mock.calls[0][0];
    expect(params.model).toBe('gpt-5-mini');
    expect(onDelta).toHaveBeenCalledWith('hello');
    expect(onDone).toHaveBeenCalled();
  });
});

describe('CineGen — generation and Element upload behaviour contract', () => {
  it('cinegen.generateElement still resolves through muapi.generateImage', async () => {
    const result = await cinegen.generateElement({ prompt: 'a noir detective' });
    expect(muapi.generateImage).toHaveBeenCalledTimes(1);
    expect(muapi.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'a noir detective' }),
    );
    expect(result.success).toBe(true);
  });

  it('ElementImageUpload still uploads through the studio media bridge and reports the URL to the caller', async () => {
    // CURRENT, CORRECT path (byte-identical to origin/main): the component
    // calls ingestStudioUpload(file, { studioId: 'element-library' }) from
    // src/lib/muapiStudioMedia.js, which validates, stores a permanent Asset
    // Library row, then uploads through the shared adapter
    // (src/lib/muapiUpload.js → official MuAPI File Upload API). The import
    // surface above pins the bridge import; these assertions pin the live
    // behaviour: the bridge receives the file and the caller gets back one
    // entry per file with the permanent URL and source 'upload'.
    const onUpload = vi.fn();
    const container = await renderComponent(createElement(ElementImageUpload as any, { onUpload }));
    const dropzone = container.querySelector('.element-upload') as HTMLElement;
    expect(dropzone).toBeTruthy();

    const file = new File(['png-bytes'], 'element-hero.png', { type: 'image/png' });
    await act(async () => {
      dispatchNativeEvent(dropzone, 'drop', { dataTransfer: { files: [file] } });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // The bridge — not a direct MuapiClient call — receives the file with the
    // element-library studio scope.
    expect(ingestStudioUpload).toHaveBeenCalledTimes(1);
    expect(ingestStudioUpload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ studioId: 'element-library' }),
    );
    // ...and the permanent URL it returned is reported to the caller.
    expect(onUpload).toHaveBeenCalledTimes(1);
    const uploaded = onUpload.mock.calls[0][0];
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].url).toBe('https://storage.test.local/element-hero.png');
    expect(uploaded[0].assetId).toBe('asset-element-hero.png');
    expect(uploaded[0].muapiUrl).toBe('https://api.muapi.ai/tmp/element-hero.png');
    expect(uploaded[0].source).toBe('upload');
  });

  it('ElementImageUpload still routes through the shared bridge into the shared upload adapter', () => {
    // Source-text pin: the component must keep delegating to ingestStudioUpload
    // (and surface bridge errors via describeMuapiUploadError) rather than
    // re-implementing an upload transport or importing MuapiClient directly.
    const source = readSource('src/components/elements/element-image-upload.jsx');
    expect(source).toContain(
      "import { ingestStudioUpload, describeMuapiUploadError } from '../../lib/muapiStudioMedia.js';",
    );
    expect(source).toContain("await ingestStudioUpload(file, { studioId: 'element-library' })");
    expect(source).toContain('await describeMuapiUploadError(err)');
    expect(source).not.toContain('MuapiClient');
    expect(source).not.toContain('uploadFileToStorage');

    // Bridge-text pin: the bridge must keep delegating to the shared adapter
    // (never a second upload implementation).
    const bridge = readSource('src/lib/muapiStudioMedia.js');
    expect(bridge).toContain("return import('./muapiUpload.js');");
    expect(bridge).toContain('await muapiUpload.validateMuAPIUpload(file)');
    expect(bridge).toContain('await muapiUpload.uploadImageToMuAPI(file, authContext)');
    expect(bridge).toContain('await muapiUpload.resolveMuAPIMediaInput(asset.id, authContext)');

    // Adapter-text pin: the adapter's image path must stay a thin wrapper over
    // the single shared transport (coreUpload) — no forked implementation.
    const adapter = readSource('src/lib/muapiUpload.js');
    expect(adapter).toContain('export function uploadImageToMuAPI(file, authContext, options = {}) {');
    expect(adapter).toContain("return coreUpload(file, authContext, options, 'image');");
  });
});
