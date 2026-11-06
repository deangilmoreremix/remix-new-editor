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
const uploadFile = vi.fn(async () => 'https://muapi.example.com/uploaded-cut.mp4');
vi.mock('../../muapi.js', () => ({ muapi: { uploadFile: (...a) => uploadFile(...a) } }));
vi.mock('../../studioChrome.js', () => ({ mountStudioChrome: () => ({ topbar: document.createElement('div') }) }));
vi.mock('../../generationHistory.js', () => ({ saveGeneration: vi.fn() }));
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: vi.fn(async () => ({ url: 'https://store.example.com/f.mp4' })) }));
vi.mock('../../apiKeyManager.js', () => ({ apiKeyManager: { getMuapiKey: () => null, getOpenAIKey: () => null } }));

const { ZackDStudio } = await import('../../../components/studios/ZackDStudio/ZackDStudio.js');
const { runAssembly } = await import('../assemble.js');
const { saveGeneration } = await import('../../generationHistory.js');

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

  it('burns captions on demand: gated on narration, confirms cost, uploads the cut, then shows the result', async () => {
    // Resume a finished project (as if reloaded) so the test starts at the final cut.
    localStorage.setItem('zackd_project_v1', JSON.stringify({ stage: 'final', topic: 'Gum', map, look: 'plasticine', sheets: {}, shots: Object.fromEntries(map.beats.flatMap((b) => b.shots).map((s) => [s.shot_id, { keyframe: 'https://cdn.example.com/k.png', clip: `https://cdn.example.com/${s.shot_id}.mp4` }])), voice: 'Casual_Guy', narration: null, music: null }));
    const root = ZackDStudio(); document.body.appendChild(root);
    await click(root, 'Assemble video');
    const burn = () => btn(root, 'Burn captions');
    expect(burn().disabled).toBe(true); // no narration yet
    expect(root.textContent).toMatch(/Generate narration first/);

    localStorage.setItem('zackd_project_v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('zackd_project_v1')), narration: 'https://cdn.example.com/n.mp3' }));
    const root2 = ZackDStudio(); document.body.appendChild(root2);
    await click(root2, 'Assemble video');
    const sel = root2.querySelector('select[aria-label="Caption language"]'); sel.value = 'Spanish (Mexico)'; sel.dispatchEvent(new Event('change'));
    const th = root2.querySelector('select[aria-label="Caption theme"]'); th.value = 'Beast'; th.dispatchEvent(new Event('change'));
    window.confirm.mockReturnValueOnce(false);
    await click(root2, 'Burn captions');
    expect(uploadFile).not.toHaveBeenCalled(); // declined the cost prompt: nothing uploaded or charged
    await click(root2, 'Burn captions');
    expect(uploadFile).toHaveBeenCalledTimes(1);
    const job = calls.find((c) => c.kind === 'captions');
    expect(job).toMatchObject({ videoUrl: 'https://muapi.example.com/uploaded-cut.mp4', language: 'Spanish (Mexico)', theme: 'Beast' });
    expect(root2.querySelectorAll('video')).toHaveLength(2); // plain cut + captioned result
    await click(root2, 'Save captioned to library');
    expect(saveGeneration).toHaveBeenCalledWith(expect.objectContaining({ studio: 'zackd', type: 'video', url: expect.stringContaining('captions') }));
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
