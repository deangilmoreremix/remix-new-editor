/**
 * defectFixVideoIntentAvailability.test.js
 *
 * Regression: checkAiAssistAvailability() gated video intent on
 * `typeof openaiService === 'object'` — always true — so the UI
 * advertised video as available even with no MuAPI key, and the user
 * only discovered the problem after a failed generation. The gate must
 * resolve the REAL MuAPI key through the canonical apiKeyManager, and
 * stay fail-safe (a missing/throwing resolver reads as "no key").
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let muapiHasKey = false;
let openaiHasKey = true;

// Mutable so the fail-safe cases can be simulated by mutation.
const keyManager = {
  hasMuapiKey: () => muapiHasKey,
  getMuapiKey: () => (muapiHasKey ? 'muapi-test-key' : null),
};

vi.mock('../../../lib/openaiService.js', () => ({
  openaiService: {
    editImageResponses: vi.fn(),
    _hasKey: () => openaiHasKey,
  },
}));

vi.mock('../../../lib/apiKeyManager.js', () => ({
  apiKeyManager: keyManager,
}));

vi.mock('../generationRouter.js', () => ({
  runGeneration: vi.fn(),
}));

vi.mock('../sharedMediaStore.js', () => ({
  sharedMediaStore: { addEntry: vi.fn() },
}));

const { checkAiAssistAvailability } = await import('../personalizeAiAssist.js');

beforeEach(() => {
  muapiHasKey = false;
  openaiHasKey = true;
  keyManager.hasMuapiKey = () => muapiHasKey;
  keyManager.getMuapiKey = () => (muapiHasKey ? 'muapi-test-key' : null);
});

describe('defect: video intent is gated on a real MuAPI key', () => {
  it('rejects video intent when no MuAPI key is configured', () => {
    const r = checkAiAssistAvailability('video');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/MuAPI/);
  });

  it('allows video intent when a MuAPI key is configured', () => {
    muapiHasKey = true;
    expect(checkAiAssistAvailability('video')).toEqual({ ok: true });
  });

  it('leaves image intent unaffected by the MuAPI key', () => {
    expect(checkAiAssistAvailability('image')).toEqual({ ok: true });
    muapiHasKey = true;
    expect(checkAiAssistAvailability('image')).toEqual({ ok: true });
    expect(checkAiAssistAvailability()).toEqual({ ok: true });
  });

  it('still reports the missing OpenAI key first', () => {
    openaiHasKey = false;
    muapiHasKey = true;
    const r = checkAiAssistAvailability('video');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/OpenAI/);
  });

  it('fails safe when the resolver throws', () => {
    keyManager.hasMuapiKey = () => { throw new Error('resolver exploded'); };
    const r = checkAiAssistAvailability('video');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/MuAPI/);
  });

  it('fails safe when the resolver exposes no key methods', () => {
    delete keyManager.hasMuapiKey;
    delete keyManager.getMuapiKey;
    const r = checkAiAssistAvailability('video');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/MuAPI/);
  });
});
