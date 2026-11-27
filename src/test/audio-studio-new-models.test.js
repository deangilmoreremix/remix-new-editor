// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/clerkEntitlements.js', async (orig) => ({ ...(await orig()), requireEntitlement: vi.fn(async () => true) }));

const tick = () => new Promise((r) => setTimeout(r, 0));
const turnsSchema = {
  type: 'array',
  title: 'Dialogue Script',
  description: 'List of speaker turns.',
  items: { type: 'object', properties: { text: { type: 'string', title: 'Text', description: 'Speech text.' }, voice_id: { type: 'string', title: 'Voice ID', enum: [{ label: 'James', value: 'v-james' }, { label: 'Eve', value: 'v-eve' }] } } },
};

describe('turns editor (Audio Studio)', () => {
  it('reports only rows that have text, with the chosen voice', async () => {
    const { createTurnsEditor } = await import('../components/AudioStudio.js');
    const seen = [];
    const el = createTurnsEditor('Dialogue Script', turnsSchema, [], (rows) => seen.push(rows));
    document.body.appendChild(el);
    expect(el.querySelectorAll('[data-turn]')).toHaveLength(1);
    const t1 = el.querySelector('[data-turn="0"] textarea');
    t1.value = 'Hello there'; t1.dispatchEvent(new Event('input'));
    const v1 = el.querySelector('[data-turn="0"] select');
    v1.value = 'v-james'; v1.dispatchEvent(new Event('change'));
    expect(seen.at(-1)).toEqual([{ text: 'Hello there', voice_id: 'v-james' }]);
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Add turn').click();
    expect(el.querySelectorAll('[data-turn]')).toHaveLength(2);
    expect(seen.at(-1)).toHaveLength(1); // the empty new row is not reported
    const t2 = el.querySelector('[data-turn="1"] textarea');
    t2.value = 'Hi!'; t2.dispatchEvent(new Event('input'));
    expect(seen.at(-1)).toEqual([{ text: 'Hello there', voice_id: 'v-james' }, { text: 'Hi!' }]);
    el.querySelector('button[aria-label="Remove turn 1"]').click();
    expect(el.querySelectorAll('[data-turn]')).toHaveLength(1);
    expect(seen.at(-1)).toEqual([{ text: 'Hi!' }]);
  });
  it('restores saved rows', async () => {
    const { createTurnsEditor } = await import('../components/AudioStudio.js');
    const el = createTurnsEditor('Dialogue Script', turnsSchema, [{ text: 'A', voice_id: 'v-eve' }, { text: 'B' }], () => {});
    expect(el.querySelectorAll('[data-turn]')).toHaveLength(2);
    expect(el.querySelector('[data-turn="0"] select').value).toBe('v-eve');
    expect(el.querySelector('[data-turn="1"] textarea').value).toBe('B');
  });
});

describe('Audio Studio with the three newly supported models', () => {
  let mounted = null;
  // Only the studio is removed: the shared toast container (created when loading.js is imported) must stay in the body.
  beforeEach(() => { localStorage.clear(); mounted?.remove(); mounted = null; vi.restoreAllMocks(); });

  // Same derivation as AudioStudio's scopedPersistKey: the saved selection lives under a key scoped to the API key.
  const persistKey = (apiKey) => {
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) hash = (hash * 31 + apiKey.charCodeAt(i)) | 0;
    return `hg_audio_studio_persistent:${(hash >>> 0).toString(36)}`;
  };

  async function mountWith(modelId) {
    const { apiKeyManager } = await import('../lib/apiKeyManager.js');
    await apiKeyManager.setMuapiKey('test-key-0123456789');
    localStorage.setItem(persistKey(apiKeyManager.getMuapiKey()), JSON.stringify({ selectedModelId: modelId }));
    const { AudioStudio } = await import('../components/AudioStudio.js');
    const el = AudioStudio();
    document.body.appendChild(el);
    mounted = el;
    return el;
  }

  it('Text to Dialogue shows the turns editor and no prompt box', async () => {
    const el = await mountWith('elevenlabs-text-to-dialogue-v3');
    expect(el.querySelector('[data-turns-editor]')).toBeTruthy();
    expect(el.textContent).toContain('Dialogue Script');
  });

  it('Convert to WAV asks for the two track ids', async () => {
    const el = await mountWith('suno-convert-to-wav');
    const labels = [...el.querySelectorAll('label')].map((l) => l.textContent.trim());
    expect(labels).toContain('Task ID');
    expect(labels).toContain('Audio ID');
  });

  it('Mashup shows its track uploader', async () => {
    const el = await mountWith('suno-generate-mashup');
    expect(el.textContent).toContain('Mashup Tracks');
  });

  it('Generate with an empty required input says what is missing and sends nothing', async () => {
    const { muapi } = await import('../lib/muapi.js');
    const spy = vi.spyOn(muapi, 'generateAudio').mockResolvedValue({ url: 'https://cdn.example.com/a.mp3' });
    const el = await mountWith('suno-convert-to-wav');
    const gen = [...el.querySelectorAll('button')].find((b) => /^generate/i.test(b.textContent.trim()));
    expect(gen, 'generate button').toBeTruthy();
    gen.click();
    await tick(); await tick();
    expect(spy).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/Please fill in: Task ID, Audio ID/);
  });

  it('Generate with the turns filled sends the dialogue array intact', async () => {
    const { muapi } = await import('../lib/muapi.js');
    const spy = vi.spyOn(muapi, 'generateAudio').mockResolvedValue({ url: 'https://cdn.example.com/a.mp3' });
    const el = await mountWith('elevenlabs-text-to-dialogue-v3');
    const t1 = el.querySelector('[data-turns-editor] [data-turn="0"] textarea');
    t1.value = 'Hello there'; t1.dispatchEvent(new Event('input'));
    const v1 = el.querySelector('[data-turns-editor] [data-turn="0"] select');
    v1.value = v1.options[1].value; v1.dispatchEvent(new Event('change'));
    const gen = [...el.querySelectorAll('button')].find((b) => /^generate/i.test(b.textContent.trim()));
    gen.click();
    for (let i = 0; i < 20 && !spy.mock.calls.length; i += 1) await tick();
    expect(spy).toHaveBeenCalledTimes(1);
    const params = spy.mock.calls[0][0];
    expect(params.model).toBe('elevenlabs-text-to-dialogue-v3');
    expect(params.dialogue).toEqual([{ text: 'Hello there', voice_id: v1.options[1].value }]);
  });
});
