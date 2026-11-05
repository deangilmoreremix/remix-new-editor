// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeBeats } from '../../../../netlify/functions/_shared/zackdPrompts.js';

const map = normalizeBeats({
  title: 'Gum',
  beats: [
    { narration: 'Is gum stuck for 7 years?', shots: [{ scene_description: 'Boy swallows gum', character_refs: ['boy'], zoom_impact: true }, { scene_description: 'Gum in esophagus', character_refs: ['gut'] }] },
    { narration: 'It passes in days.', shots: [{ scene_description: 'Relief', character_refs: ['boy'] }] },
  ],
  character_sheets: { boy: 'Boy in blue shirt', gut: 'Pink gut cutaway' },
}, { topic: 'Gum' });

const calls = [];
vi.mock('../api.js', async (orig) => ({
  ...(await orig()),
  call: vi.fn(async (b) => { calls.push(b); if (b.action === 'script') return { ok: true, map }; return { ok: true, topics: [{ topic: 'T1', hook: 'H1', category: 'c' }] }; }),
  runJob: vi.fn(async (b) => { calls.push(b); return { url: `https://cdn.example.com/${b.kind}-${calls.length}`, model: 'm' }; }),
}));
vi.mock('../assemble.js', async (orig) => ({ ...(await orig()), runAssembly: vi.fn(async () => ({ blob: new Blob(['x'], { type: 'video/mp4' }), duration: 9 })) }));
vi.mock('../../studioChrome.js', () => ({ mountStudioChrome: () => ({ topbar: document.createElement('div') }) }));
vi.mock('../../generationHistory.js', () => ({ saveGeneration: vi.fn() }));
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: vi.fn(async () => ({ url: 'https://store.example.com/f.mp4' })) }));
vi.mock('../../apiKeyManager.js', () => ({ apiKeyManager: { getMuapiKey: () => null, getOpenAIKey: () => null } }));

const { ZackDStudio } = await import('../../../components/studios/ZackDStudio/ZackDStudio.js');
const { runAssembly } = await import('../assemble.js');

const tick = () => new Promise((r) => setTimeout(r, 20));
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
async function click(root, text) {
  const b = btn(root, text);
  expect(b, `button "${text}"`).toBeTruthy();
  expect(b.disabled, `button "${text}" disabled`).toBe(false);
  b.click(); await tick(); await tick();
}

describe('ZackDStudio flow', () => {
  beforeEach(() => { localStorage.clear(); calls.length = 0; vi.spyOn(window, 'confirm').mockReturnValue(true); URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn(); });

  it('walks topic → script → visuals → clips → audio → final cut', async () => {
    const root = ZackDStudio();
    document.body.appendChild(root);
    // topic
    expect(btn(root, 'Write script').disabled).toBe(true);
    btn(root, 'T1' ) || null;
    root.querySelector('input').value = 'Gum'; root.querySelector('input').dispatchEvent(new Event('input'));
    await click(root, 'Write script');
    // script (Gate 1): edit narration persists
    const ta = root.querySelector('textarea'); ta.value = 'Edited hook?'; ta.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem('zackd_project_v1')).map.beats[0].narration).toBe('Edited hook?');
    await click(root, 'Approve script');
    // visuals: 2 sheets then 3 keyframes
    await click(root, 'character sheet');
    expect(calls.filter((c) => c.kind === 'image' && c.aspect === '16:9')).toHaveLength(2);
    expect(btn(root, 'Approve keyframes').disabled).toBe(true);
    await click(root, 'keyframe(s)');
    const kf = calls.filter((c) => c.kind === 'image' && c.aspect === '9:16');
    expect(kf).toHaveLength(3);
    expect(kf[0].prompt).toContain('Boy in blue shirt'); // character anchor is carried into keyframes
    await click(root, 'Approve keyframes');
    // clips use the keyframe URLs
    await click(root, 'clip(s)');
    const clips = calls.filter((c) => c.kind === 'clip');
    expect(clips).toHaveLength(3);
    expect(clips.every((c) => c.imageUrl.startsWith('https://cdn.example.com/image'))).toBe(true);
    await click(root, 'Continue to audio');
    // audio
    await click(root, 'Generate narration');
    expect(calls.find((c) => c.kind === 'tts').text).toBe('Edited hook? It passes in days.');
    await click(root, 'Continue to final cut');
    // final
    await click(root, 'Assemble video');
    const args = runAssembly.mock.calls[0][0];
    expect(args.clips).toHaveLength(3);
    expect(args.clips[0]).toMatchObject({ zoom: true, duration: 3 });
    expect(args.narrationUrl).toMatch(/tts/);
    expect(root.querySelector('video')).toBeTruthy();
    await click(root, 'Save to library');
    expect(btn(root, 'Saved to library').disabled).toBe(true);
    // reload keeps the project but not the (dead) object URL
    const again = ZackDStudio();
    expect(again.querySelector('video')).toBeNull();
    expect(JSON.parse(localStorage.getItem('zackd_project_v1')).final).toBeUndefined();
  });

  it('shows an error when a batch fails, without leaving the studio busy', async () => {
    const { runJob } = await import('../api.js');
    const root = ZackDStudio(); document.body.appendChild(root);
    root.querySelector('input').value = 'Gum'; root.querySelector('input').dispatchEvent(new Event('input'));
    await click(root, 'Write script'); await click(root, 'Approve script');
    runJob.mockRejectedValueOnce(Object.assign(new Error('Your MuAPI key was rejected.'), { code: 'bad_key' }));
    await click(root, 'character sheet');
    expect(root.querySelector('[role=alert]').textContent).toContain('MuAPI key was rejected');
    expect(btn(root, 'character sheet').disabled).toBe(false);
  });
});
