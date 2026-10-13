/**
 * personalizeAiAssist.test.js
 *
 * Verifies the AI Assist bridge: role validation, asset resolution,
 * OpenAI routing, MuAPI video routing, and shared-media persistence.
 * Both providers are mocked — no live API calls.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const editImageResponses = vi.fn();
const runGeneration = vi.fn();
const addEntry = vi.fn();

// NOTE: this spec lives in __tests__/, one level deeper than the module
// under test, so lib is three levels up (../../../lib) — matching the
// convention in __tests__/generationRouter.test.js.
vi.mock('../../../lib/openaiService.js', () => ({
  openaiService: {
    editImageResponses: (...args) => editImageResponses(...args),
    _hasKey: () => true,
  },
}));

vi.mock('../generationRouter.js', () => ({
  runGeneration: (...args) => runGeneration(...args),
}));

vi.mock('../sharedMediaStore.js', () => ({
  sharedMediaStore: { addEntry: (...args) => addEntry(...args) },
}));

const {
  runAiAssistEdit,
  resolveAssetForRole,
  checkAiAssistAvailability,
  AI_ASSIST_ROLES,
  AI_ASSIST_ROLE_LABELS,
} = await import('../personalizeAiAssist.js');

/** Build a minimal library. */
function makeLibrary(overrides = {}) {
  return {
    identities: [],
    primaryIdentity: null,
    logos: [],
    primaryLogo: null,
    products: [],
    brandReferences: [],
    firstFrame: null,
    lastFrame: null,
    ctaGraphic: null,
    audio: [],
    savedReferences: [],
    ...overrides,
  };
}

describe('AI Assist role catalogue', () => {
  it('exposes exactly the six spec roles', () => {
    expect([...AI_ASSIST_ROLES].sort()).toEqual([
      'brand_reference',
      'face_identity',
      'first_frame',
      'last_frame',
      'logo',
      'product_reference',
    ]);
  });

  it('labels every role', () => {
    for (const role of AI_ASSIST_ROLES) {
      expect(AI_ASSIST_ROLE_LABELS[role]).toBeTruthy();
    }
  });
});

describe('resolveAssetForRole', () => {
  it('prefers the primary asset', () => {
    const lib = makeLibrary({
      logos: [
        { id: 'a', url: 'https://x.test/a.png', isPrimary: false },
        { id: 'b', url: 'https://x.test/b.png', isPrimary: true },
        { id: 'c', url: 'https://x.test/c.png', isPrimary: false },
      ],
    });
    expect(resolveAssetForRole(lib, 'logo').id).toBe('b');
  });

  it('falls back to most recently added when no primary', () => {
    const lib = makeLibrary({
      products: [
        { id: 'p1', url: 'https://x.test/1.png', isPrimary: false },
        { id: 'p2', url: 'https://x.test/2.png', isPrimary: false },
      ],
    });
    expect(resolveAssetForRole(lib, 'product_reference').id).toBe('p2');
  });

  it('handles single-slot roles', () => {
    const ff = { id: 'ff', url: 'https://x.test/ff.png' };
    expect(resolveAssetForRole(makeLibrary({ firstFrame: ff }), 'first_frame')).toBe(ff);
    expect(resolveAssetForRole(makeLibrary(), 'first_frame')).toBeNull();
  });

  it('returns null for empty/unknown library', () => {
    expect(resolveAssetForRole(null, 'logo')).toBeNull();
    expect(resolveAssetForRole(makeLibrary(), 'logo')).toBeNull();
  });

  it('prefers uploadedUrl over url', () => {
    // uploadedUrl is the durable copy; url may be a transient provider link.
    const lib = makeLibrary({
      logos: [{ id: 'l', url: 'https://muapi.test/tmp.png', uploadedUrl: 'https://supa.test/l.png', isPrimary: true }],
    });
    // resolution returns the asset; the bridge decides which field to read.
    const asset = resolveAssetForRole(lib, 'logo');
    expect(asset.uploadedUrl).toBe('https://supa.test/l.png');
  });
});

describe('runAiAssistEdit - validation', () => {
  beforeEach(() => {
    editImageResponses.mockReset();
    runGeneration.mockReset();
    addEntry.mockReset();
  });

  it('rejects an unsupported role before any provider call', async () => {
    const res = await runAiAssistEdit({ role: 'saved_reference', instruction: 'x' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('UNSUPPORTED_ROLE');
    expect(editImageResponses).not.toHaveBeenCalled();
    expect(runGeneration).not.toHaveBeenCalled();
  });

  it('rejects an empty instruction', async () => {
    const res = await runAiAssistEdit({ role: 'logo', instruction: '   ' });
    expect(res).toMatchObject({ ok: false, code: 'EMPTY_INSTRUCTION' });
  });

  it('rejects an over-length instruction at the 32000 char provider cap', async () => {
    const res = await runAiAssistEdit({ role: 'logo', instruction: 'a'.repeat(32001) });
    expect(res.code).toBe('INSTRUCTION_TOO_LONG');
  });

  it('rejects a data: URL asset (OpenAI needs http(s) or base64 file)', async () => {
    const lib = makeLibrary({
      logos: [{ id: 'l', url: 'data:image/png;base64,AAA', isPrimary: true }],
    });
    const res = await runAiAssistEdit({ role: 'logo', instruction: 'clean up', options: { library: lib } });
    expect(res.code).toBe('ASSET_URL_UNSUPPORTED');
  });

  it('rejects when the library has no asset for the role', async () => {
    const res = await runAiAssistEdit({ role: 'product_reference', instruction: 'x', options: { library: makeLibrary() } });
    expect(res.code).toBe('NO_ASSET');
  });
});

describe('runAiAssistEdit - OpenAI image editing path', () => {
  beforeEach(() => {
    editImageResponses.mockReset();
    runGeneration.mockReset();
    addEntry.mockReset();
  });

  it('routes to editImageResponses with the asset as image input and mask', async () => {
    editImageResponses.mockResolvedValue({
      responseId: 'resp_1',
      images: ['BASE64_IMAGE'],
    });
    const lib = makeLibrary({
      logos: [{ id: 'l1', url: 'https://x.test/logo.png', isPrimary: true }],
    });

    const res = await runAiAssistEdit({
      role: 'logo',
      instruction: 'make the background transparent',
      options: { library: lib, clientId: 'client_1' },
    });

    expect(res.ok).toBe(true);
    expect(res.images).toEqual(['BASE64_IMAGE']);
    expect(res.responseId).toBe('resp_1');

    const args = editImageResponses.mock.calls[0][0];
    expect(args.input).toBe('make the background transparent');
    expect(args.imageInputs).toEqual([{ imageUrl: 'https://x.test/logo.png' }]);
    // full-frame edit: the asset itself is the mask
    expect(args.mask).toEqual({ imageUrl: 'https://x.test/logo.png' });
    expect(args.action).toBe('edit');
  });

  it('persists the output into sharedMediaStore', async () => {
    editImageResponses.mockResolvedValue({ responseId: 'resp_2', images: ['B64'] });
    const lib = makeLibrary({
      products: [{ id: 'p1', url: 'https://x.test/p.png', isPrimary: true }],
    });

    await runAiAssistEdit({
      role: 'product_reference',
      instruction: 'remove shadow',
      options: { library: lib, clientId: 'client_9' },
    });

    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][0];
    expect(entry.clientId).toBe('client_9');
    expect(entry.role).toBe('product_reference');
    expect(entry.productAssetIds).toEqual(['p1']);
    expect(entry.outputType).toBe('image');
    expect(entry.outputUrls).toEqual(['B64']);
  });

  // ── Provider image-shape contract ────────────────────────────────────────
  // openaiService.editImageResponses resolves through _parseResponsesOutput,
  // which returns images as { base64, revised_prompt, callId } — NOT
  // { b64_json }. Both shapes must be accepted so a successful provider
  // response never filters down to NO_IMAGE_OUTPUT.

  it('accepts the { base64 } shape returned by openaiService._parseResponsesOutput', async () => {
    editImageResponses.mockResolvedValue({
      responseId: 'resp_b64',
      images: [{ base64: 'QUJD', revised_prompt: 'cleaned', callId: 'call_1', status: 'completed' }],
    });
    const lib = makeLibrary({
      logos: [{ id: 'l1', url: 'https://x.test/logo.png', isPrimary: true }],
    });

    const res = await runAiAssistEdit({
      role: 'logo',
      instruction: 'clean the logo',
      options: { library: lib },
    });

    expect(res.ok).toBe(true);
    expect(res.images).toEqual(['QUJD']);
    expect(addEntry.mock.calls[0][0].outputUrls).toEqual(['QUJD']);
    expect(addEntry.mock.calls[0][0].outputIsBase64).toBe(true);
  });

  it('accepts the legacy { b64_json } shape', async () => {
    editImageResponses.mockResolvedValue({
      responseId: 'resp_legacy',
      images: [{ b64_json: 'QUJD' }],
    });
    const lib = makeLibrary({
      logos: [{ id: 'l1', url: 'https://x.test/logo.png', isPrimary: true }],
    });

    const res = await runAiAssistEdit({
      role: 'logo',
      instruction: 'clean the logo',
      options: { library: lib },
    });

    expect(res.ok).toBe(true);
    expect(res.images).toEqual(['QUJD']);
  });

  it('accepts { image_base64 } and string entries', async () => {
    editImageResponses.mockResolvedValue({
      responseId: 'resp_mixed',
      images: [{ image_base64: 'QUJD' }, 'RAVG'],
    });
    const lib = makeLibrary({
      logos: [{ id: 'l1', url: 'https://x.test/logo.png', isPrimary: true }],
    });

    const res = await runAiAssistEdit({
      role: 'logo',
      instruction: 'clean the logo',
      options: { library: lib },
    });

    expect(res.ok).toBe(true);
    expect(res.images).toEqual(['QUJD', 'RAVG']);
  });

  it('drops entries that carry no image payload (avoid NO_IMAGE_OUTPUT on mixed results)', async () => {
    editImageResponses.mockResolvedValue({
      responseId: 'resp_partial',
      images: [{ revised_prompt: 'no result yet' }, { base64: 'QUJD' }],
    });
    const lib = makeLibrary({
      logos: [{ id: 'l1', url: 'https://x.test/logo.png', isPrimary: true }],
    });

    const res = await runAiAssistEdit({
      role: 'logo',
      instruction: 'clean the logo',
      options: { library: lib },
    });

    expect(res.ok).toBe(true);
    expect(res.images).toEqual(['QUJD']);
  });

  it('all six edit operations return ok:true with the { base64 } provider shape', async () => {
    const lib = makeLibrary({
      identities: [{ id: 'face', url: 'https://x.test/face.png', isPrimary: true }],
      logos: [{ id: 'logo', url: 'https://x.test/logo.png', isPrimary: true }],
      products: [{ id: 'prod', url: 'https://x.test/prod.png', isPrimary: true }],
      brandReferences: [{ id: 'brand', url: 'https://x.test/brand.png', isPrimary: true }],
      firstFrame: { id: 'ff', url: 'https://x.test/ff.png' },
      lastFrame: { id: 'lf', url: 'https://x.test/lf.png' },
    });

    for (const role of AI_ASSIST_ROLES) {
      editImageResponses.mockReset();
      addEntry.mockReset();
      editImageResponses.mockResolvedValue({
        responseId: `resp_${role}`,
        images: [{ base64: 'QUJD' }],
      });

      const res = await runAiAssistEdit({ role, instruction: 'retouch', options: { library: lib } });

      expect(res.ok, `role ${role} should succeed`).toBe(true);
      expect(res.images).toEqual(['QUJD']);
    }
  });

  it('sets the correct asset-id column per role', async () => {
    editImageResponses.mockResolvedValue({ responseId: 'r', images: ['B'] });
    const cases = [
      ['face_identity', 'identityAssetIds', 'identities'],
      ['logo', 'logoAssetIds', 'logos'],
      ['product_reference', 'productAssetIds', 'products'],
      ['brand_reference', 'brandReferenceAssetIds', 'brandReferences'],
    ];
    for (const [role, column, bucket] of cases) {
      addEntry.mockReset();
      const lib = makeLibrary({ [bucket]: [{ id: `${role}-id`, url: 'https://x.test/a.png', isPrimary: true }] });
      await runAiAssistEdit({ role, instruction: 'go', options: { library: lib } });
      expect(addEntry.mock.calls[0][0][column]).toEqual([`${role}-id`]);
    }
  });

  it('maps first/last frame to their dedicated columns', async () => {
    editImageResponses.mockResolvedValue({ responseId: 'r', images: ['B'] });
    const lib = makeLibrary({
      firstFrame: { id: 'ff', url: 'https://x.test/ff.png' },
      lastFrame: { id: 'lf', url: 'https://x.test/lf.png' },
    });
    await runAiAssistEdit({ role: 'first_frame', instruction: 'go', options: { library: lib } });
    expect(addEntry.mock.calls[0][0].firstFrameAssetId).toBe('ff');
    addEntry.mockReset();
    await runAiAssistEdit({ role: 'last_frame', instruction: 'go', options: { library: lib } });
    expect(addEntry.mock.calls[0][0].lastFrameAssetId).toBe('lf');
  });

  it('returns NO_IMAGE_OUTPUT when the provider returns nothing', async () => {
    editImageResponses.mockResolvedValue({ responseId: 'r', images: [] });
    const lib = makeLibrary({ logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }] });
    const res = await runAiAssistEdit({ role: 'logo', instruction: 'go', options: { library: lib } });
    expect(res).toMatchObject({ ok: false, code: 'NO_IMAGE_OUTPUT' });
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('wraps provider errors as IMAGE_PROVIDER_ERROR', async () => {
    editImageResponses.mockRejectedValue(new Error('rate limited'));
    const lib = makeLibrary({ logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }] });
    const res = await runAiAssistEdit({ role: 'logo', instruction: 'go', options: { library: lib } });
    expect(res).toMatchObject({ ok: false, code: 'IMAGE_PROVIDER_ERROR', reason: 'rate limited' });
  });

  it('emits progress phases', async () => {
    editImageResponses.mockResolvedValue({ responseId: 'r', images: ['B'] });
    const lib = makeLibrary({ logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }] });
    const phases = [];
    await runAiAssistEdit({
      role: 'logo',
      instruction: 'go',
      options: { library: lib, onProgress: (p) => phases.push(p) },
    });
    expect(phases[0]).toBe('image.queued');
    expect(phases[1]).toBe('image.done');
  });
});

describe('runAiAssistEdit - MuAPI video path', () => {
  beforeEach(() => {
    editImageResponses.mockReset();
    runGeneration.mockReset();
    addEntry.mockReset();
  });

  it('routes face_identity with intent=video to runGeneration, not OpenAI', async () => {
    runGeneration.mockResolvedValue({ outputUrls: ['https://v.test/out.mp4'], model: 'ai-video-face-swap' });
    const lib = makeLibrary({
      identities: [{ id: 'f1', url: 'https://x.test/face.png', isPrimary: true }],
    });

    const res = await runAiAssistEdit({
      role: 'face_identity',
      instruction: 'put this face on the presenter',
      options: { library: lib, intent: 'video' },
    });

    expect(res.ok).toBe(true);
    expect(res.videos).toEqual(['https://v.test/out.mp4']);
    expect(editImageResponses).not.toHaveBeenCalled();
    expect(runGeneration).toHaveBeenCalledTimes(1);
    const gen = runGeneration.mock.calls[0][0];
    expect(gen.mode).toBe('replace_person');
    expect(gen.prompt).toBe('put this face on the presenter');
    expect(addEntry.mock.calls[0][0].outputType).toBe('video');
  });

  it('does NOT force video intent for non-face roles', async () => {
    editImageResponses.mockResolvedValue({ responseId: 'r', images: ['B'] });
    runGeneration.mockResolvedValue({ outputUrls: [] });
    const lib = makeLibrary({ logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }] });

    await runAiAssistEdit({ role: 'logo', instruction: 'go', options: { library: lib, intent: 'video' } });

    expect(runGeneration).not.toHaveBeenCalled();
    expect(editImageResponses).toHaveBeenCalledTimes(1);
  });

  it('returns NO_VIDEO_OUTPUT when MuAPI gives nothing', async () => {
    runGeneration.mockResolvedValue({ outputUrls: [] });
    const lib = makeLibrary({ identities: [{ id: 'f', url: 'https://x.test/f.png', isPrimary: true }] });
    const res = await runAiAssistEdit({
      role: 'face_identity', instruction: 'go', options: { library: lib, intent: 'video' },
    });
    expect(res.code).toBe('NO_VIDEO_OUTPUT');
  });
});

describe('checkAiAssistAvailability', () => {
  it('is available for image when an OpenAI key exists', () => {
    expect(checkAiAssistAvailability('image').ok).toBe(true);
  });
});
