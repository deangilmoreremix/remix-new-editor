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
 *
 * If a change to a protected app or a shared contract is intentional and
 * approved, update this baseline deliberately (re-record the sha256 values and
 * signatures) — do not weaken or delete the assertions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
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
  return createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex');
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
        // Temporary-asset routing: proxy endpoint must remain upload_file
        "'x-endpoint': 'upload_file',",
        // Architectural constraint: 402/403/413/422 must never be silently
        // bypassed onto the Supabase fallback.
        'if (status === 402 || status === 403 || status === 413 || status === 422) {',
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
      app: 'CineGen — Elements image upload (MuapiClient.uploadFile call site)',
      imports: ["import { MuapiClient } from '../../lib/muapi.js';"],
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
    // The protected apps may only reach upload services through the eight
    // shared modules guarded above. Any other import specifier that looks like
    // an upload service in a protected file is a red flag.
    const allowed = [
      '../lib/hybrid-supabase.js',
      './hybrid-supabase.js',
      '../lib/uploadService.js',
      '../lib/editor/uploadPipeline.js',
      './uploadPipeline.js',
      '../lib/editor/upload.js',
      '../lib/muapi.js',
      './muapi.js',
      '../../lib/muapi.js',
      '../lib/supabase.js',
      './supabase.js',
      '../../supabase.js',
      '../lib/editor/uploadSources.js',
      '../lib/editor/dragDrop.js',
    ];
    const protectedFiles = [
      'src/components/TimelineEditorPage.jsx',
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
    for (const file of protectedFiles) {
      const source = readSource(file);
      const specs = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const spec of specs) {
        if (/(upload|muapi|supabase|storage|hybrid)/i.test(spec)) {
          expect(
            allowed,
            `${file} imports upload-related module '${spec}' which is outside the shared upload contract set`,
          ).toContain(spec);
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
  const PROTECTED_BASELINE: Array<[string, string]> = [
    ['src/components/TimelineEditorPage.jsx', '3c9cbe2225a0f83f43242bededdb6f48ed35de3113b4706515275977e0dbd3b2'],
    ['src/components/ChatStudio.js', 'db1bd102fcd24ac1174550ea6047fe55219aebba41169b2c2fb84df33ea966d8'],
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
    ['src/lib/cinegen.js', '5ade4ff2985ef2fb594156909564e0755051258693e3e6aeeeb4134f26ec741c'],
    ['src/lib/cinegenIntegration.js', 'd73459062a6ff89b78b3196a7fc90c140ff491c1ffeafc18f28769d24cec706d'],
    ['src/modules/CineGen/src/layout/CineGenLayout.tsx', 'b3b232c358d01931e066ddf5d779a80a7280de70a13c8ab6c72c93b31def9e3a'],
    ['src/components/elements/element-card.jsx', 'd6bcaa6ec593761739b590a6370241f280ef7fda6e30354eb07da03c6e779bf1'],
    ['src/components/elements/element-generate.jsx', '7fc3ab1fa298a640f20070f70f93c17fcf8fe9289523a343cd6cc4bb6c799525'],
    ['src/components/elements/element-image-upload.jsx', '3ead6813bd19c70684dc13f573c675d125a93cfd891d023cf4507801a05aeb0b'],
    ['src/components/elements/element-modal.jsx', '47bfd626878bf6851b8f156ad1fdfe94216e252a027c55d841b50957b81a5948'],
    ['src/components/elements/elements-tab.jsx', 'aa69f0f4b9568c61de475b385738d3b7a273bcf9dd2fdd733b8b01c0590b5864'],
    ['src/components/RetakePanel.jsx', '56a4a967fb1d99ee84e1e14613bf803db97edb20f9dad5dc51e56ba0ce89c69f'],
    ['src/components/ICLoraPanel.jsx', '89ca90c33d5a447699e67e9aad7ef2afb0e531379a19f85fc83744aa6135cd70'],
    ['src/components/modals/ExtendModal.jsx', '858fab83c74da4b39551b54099d355c38994bc0c170c4469e0341a590186f180'],
    ['src/components/modals/FillGapModal.jsx', 'a54bf8adc5ecf4288d467b435bb4b39a12f8fb40f06fbfca9c7219a9170e1cb6'],
    ['src/components/modals/MusicGenerationModal.jsx', 'a4c551e4f9eb1cd39002a20db266fd54a949f9af29821a094e8e8113ea8d3a72'],
    ['src/components/timeline/AIChatPanel.js', '192992eb516b5d44e1d670b79fc3799f74e277447bf33d94c0653b4260667873'],
    ['src/components/create/nodes/music-prompt-node.jsx', '466215193c99448ae2c2b52ae63da76e57cca7735157bbdab87ad508ae207089'],
    // Protected applications' own tests must not change either.
    ['src/components/elements/__tests__/elements.test.jsx', '4df4e6a1788252bab3553b1e52c129cbc4dbf70e87ebe92cdc2b0b168bf9086e'],
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
    ['src/lib/editor/__tests__/timeline-history.test.js', 'dee7ee02e32db2cf700a45e8f1aee9a8ec6c198d7953c510cee7bc3654ebc1ce'],
    ['src/lib/editor/__tests__/timeline-operations.test.js', '2cf48c06362a441f6005b49b9b75047f12666e407fb583e2034e62ba28cdc4df'],
    ['src/lib/editor/__tests__/timeline-state-multitab.test.js', 'b0df5878f31b1efd9879d40736fbfd28b7eebc197394a30d33ece3df95b403af'],
    ['src/lib/editor/__tests__/timeline-track-controls.test.js', '91925a63b3deb493a8c0ae2c03ce787f70646be810b4b57aa4251fbd6d5cc7d3'],
    ['src/lib/editor/__tests__/timeline-editor-mask.test.js', '591901aa5d3add68baa1c2d8b86dbbe1dafd32fb2cd4711a3700d5c3aa97eef9'],
    ['src/lib/editor/__tests__/timeline-feature-api.test.js', '29a24abc1c81fb4eb63d995eceff6d129499afb166f4744a81dccc5e9bcdbcf2'],
    ['src/lib/editor/__tests__/tool-parity.test.js', 'cff39b76a43bf9c74662016547d141e06dd44a51accc9082c72515e2849aba44'],
  ];

  it.each(PROTECTED_BASELINE)('%s matches its recorded sha256 baseline', (file, expected) => {
    expect(
      sha256(file),
      `PROTECTED FILE MODIFIED: ${file}. Protected applications (Timeline Studio/Timeline Editor, CineGen, Chat) must not be changed by the upload-pipeline repair. If this change was intentional and approved, re-record the baseline sha256 in this guard deliberately.`,
    ).toBe(expected);
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

  it('ElementImageUpload still uploads through MuapiClient.uploadFile and reports the URL to the caller', async () => {
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

    expect(muapi.uploadFile).toHaveBeenCalledWith(file);
    expect(onUpload).toHaveBeenCalledTimes(1);
    const uploaded = onUpload.mock.calls[0][0];
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].url).toBe('https://cdn.muapi.ai/element-hero.png');
    expect(uploaded[0].source).toBe('upload');
  });
});
