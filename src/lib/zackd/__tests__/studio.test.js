// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  call: vi.fn(async (b) => { calls.push(b); if (b.action === 'script') return { ok: true, map }; return { ok: true, topics: [] }; }),
  runJob: vi.fn(async (b, opts) => { calls.push(b); opts?.onRequestId?.(`req_${calls.length}`); return { url: `https://cdn.example.com/${b.kind}-${calls.length}`, model: 'm' }; }),
  pollJob: vi.fn(async () => ({ url: 'https://cdn.example.com/resumed' })),
}));
vi.mock('../assemble.js', async (orig) => ({ ...(await orig()), runAssembly: vi.fn(async () => ({ blob: new Blob(['x'], { type: 'video/mp4' }), duration: 38.6 })) }));
const uploadFile = vi.fn(async () => 'https://muapi.example.com/uploaded-cut.mp4');
vi.mock('../../muapi.js', () => ({ muapi: { uploadFile: (...a) => uploadFile(...a) } }));
vi.mock('../../studioChrome.js', () => ({ mountStudioChrome: vi.fn(() => ({ topbar: null })) }));
const createStudioHeader = vi.fn((id, title) => { const d = document.createElement('div'); d.dataset.studioHeader = id; d.textContent = title; return d; });
vi.mock('../../thumbnails.js', () => ({ createStudioHeader: (...a) => createStudioHeader(...a) }));
vi.mock('../../modelSelectorUI.js', () => ({ positionModelSelectorDropdown: vi.fn() }));
vi.mock('../../generationHistory.js', () => ({ saveGeneration: vi.fn() }));
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: vi.fn(async () => ({ url: 'https://store.example.com/f.mp4' })) }));
vi.mock('../../../components/studio/generationNotifications.js', () => ({ notifyGeneration: vi.fn() }));

const { ZackDStudio } = await import('../../../components/studios/ZackDStudio/ZackDStudio.js');
const { runAssembly } = await import('../assemble.js');
const { runJob, pollJob } = await import('../api.js');
const { savePendingJob } = await import('../../pendingJobs.js');
const { saveGeneration } = await import('../../generationHistory.js');
const { mountStudioChrome } = await import('../../studioChrome.js');

const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const btnText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
async function until(fn, label = 'condition') { for (let i = 0; i < 120; i += 1) { if (fn()) return; await tick(10); } throw new Error(`timed out waiting for ${label}`); }
const generate = (root) => root.querySelector('button.btn-primary-modern');
async function click(root, text) {
  const b = btnText(root, text);
  expect(b, `button "${text}"`).toBeTruthy();
  expect(b.disabled, `button "${text}" disabled`).toBe(false);
  b.click(); await tick(); await tick();
}
async function step(root, label) { await until(() => generate(root).textContent.includes(label) && !generate(root).disabled, `Generate button "${label}" (is "${generate(root).textContent}")`); }

function mount() { const root = ZackDStudio(); document.body.appendChild(root); return root; }
function typeTopic(root, v) { const t = root.querySelector('#z-prompt-textarea'); t.value = v; t.dispatchEvent(new Event('input')); }

describe('ZackDStudio (built like the other video studios)', () => {
  beforeEach(() => {
    document.body.replaceChildren(); localStorage.clear(); calls.length = 0; runAssembly.mockClear(); runJob.mockClear(); uploadFile.mockClear(); saveGeneration.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true); URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
  });

  it('has the same shell as VideoStudio: root classes, hero header, prompt bar, control pills, Generate button', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/VideoStudio.js'), 'utf8');
    const rootClass = src.match(/container\.className = '([^']+)'/)[1];
    const barClass = src.match(/bar\.className = '([^']+)'/)[1];
    const genClass = src.match(/generateBtn\.className = '(btn-primary-modern[^']*)'/)[1].split(' ')[0];
    const root = mount();
    expect(root.className).toBe(rootClass);
    expect(mountStudioChrome).toHaveBeenCalledWith(root, { currentRoute: 'zackd' });
    expect(createStudioHeader).toHaveBeenCalledWith('zackd', 'Zack D Studio', expect.any(String));
    expect(root.querySelector('div.shadow-3xl').className).toBe(barClass);
    expect(root.querySelector('textarea[data-studio-prompt]')).toBeTruthy();
    for (const id of ['z-look-btn', 'z-voice-btn', 'z-ar-btn', 'z-templates-btn', 'z-advanced-btn']) expect(root.querySelector(`#${id}`), id).toBeTruthy();
    expect(generate(root).className).toContain(genClass);
    expect(root.querySelector('#zackd-history-sidebar').className).toContain('fixed right-0 top-0 h-full w-20 md:w-24');
  });

  it('runs topic -> script gate -> sheets -> keyframes -> clips -> final cut, one Generate button, with cost confirms', async () => {
    const root = mount();
    expect(generate(root).textContent).toContain('Write script');
    expect(generate(root).disabled).toBe(true); // nothing typed yet
    typeTopic(root, 'Why do ears pop?');
    await step(root, 'Write script');
    generate(root).click();
    await step(root, 'Approve script');
    // Gate 1: the beat cards are editable and the edit is what gets used
    const nar = root.querySelector('textarea[aria-label="Narration, beat 1"]'); nar.value = 'Edited hook?'; nar.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem('zackd_project_v1')).map.beats[0].narration).toBe('Edited hook?');
    generate(root).click(); // approving starts the character sheets (after the cost confirm)
    await step(root, 'Generate 3 keyframes');
    expect(calls.filter((c) => c.kind === 'image' && c.aspect === '16:9')).toHaveLength(2);
    generate(root).click();
    await step(root, 'Animate 3 clips');
    const kf = calls.filter((c) => c.kind === 'image' && c.aspect === '9:16');
    expect(kf).toHaveLength(3);
    expect(kf[0].prompt).toContain('Anchored on character sheet refs: boy'); // upstream's anchor sentence
    generate(root).click();
    await step(root, 'Render final cut');
    const clips = calls.filter((c) => c.kind === 'clip');
    expect(clips).toHaveLength(3);
    expect(clips.every((c) => c.imageUrl.startsWith('https://cdn.example.com/image') && c.prompt.startsWith('Smooth 3D animation, camera movement '))).toBe(true);
    expect(window.confirm).toHaveBeenCalledTimes(3); // sheets, keyframes, clips
    generate(root).click();
    await until(() => runAssembly.mock.calls.length === 1, 'assembly');
    const args = runAssembly.mock.calls[0][0];
    expect(args.clips).toHaveLength(3);
    expect(args.clips[0]).toMatchObject({ zoom: true, planned: 3 });
    expect(args).toMatchObject({ keepClipAudio: true, mixVoice: false, trimToPlanned: false }); // upstream defaults
    await until(() => btnText(root, 'Download MP4'), 'final cut result');
    expect(root.querySelector('video[src="blob:x"]')).toBeTruthy();
  });

  it('uses the app\'s pending-job tracker for every media job', async () => {
    const root = mount();
    typeTopic(root, 'Gum'); await step(root, 'Write script'); generate(root).click();
    await step(root, 'Approve script'); generate(root).click();
    await step(root, 'Generate 3 keyframes');
    const pendingBefore = JSON.parse(localStorage.getItem('muapi_pending_jobs') || '[]');
    expect(pendingBefore).toHaveLength(0); // each job is removed once it finishes
    expect(runJob.mock.calls.every(([, opts]) => typeof opts.onRequestId === 'function')).toBe(true);
  });

  it('a finished template jumps to a final cut with no generation calls, upstream defaults on', async () => {
    const root = mount();
    expect(root.textContent).toMatch(/Sample from the upstream open-source Zack D project/);
    await click(root, 'Use as template');
    expect(root.querySelector('textarea[aria-label="Narration, beat 1"]').value).toMatch(/Swallow Gum/);
    expect(root.querySelectorAll('video').length).toBeGreaterThan(5); // 5 shot clips + the template demo
    await step(root, 'Render final cut');
    generate(root).click();
    await until(() => runAssembly.mock.calls.length === 1, 'assembly');
    const args = runAssembly.mock.calls[0][0];
    expect(args.clips).toHaveLength(5);
    expect(args.clips.every((c) => /\/zackd\/templates\/swallow-gum\/clips\/beat_/.test(c.url))).toBe(true);
    expect(args).toMatchObject({ keepClipAudio: true, mixVoice: false, trimToPlanned: false });
    expect(calls).toHaveLength(0); // no image/clip/tts/music job was submitted
  });

  it('extras are opt-in, off by default, and a generated voice switches mixing on', async () => {
    const root = mount();
    expect(root.querySelector('#zackd-keep-clip-audio').checked).toBe(true);
    for (const id of ['zackd-mix-voice', 'zackd-trim-planned', 'zackd-boost']) expect(root.querySelector(`#${id}`).checked, id).toBe(false);
    await click(root, 'Use as template');
    await until(() => btnText(root, 'Generate narration'), 'audio section');
    await click(root, 'Generate narration');
    await until(() => root.querySelector('audio'), 'narration audio');
    expect(root.querySelector('#zackd-mix-voice').checked).toBe(true);
    const trim = root.querySelector('#zackd-trim-planned'); trim.checked = true; trim.dispatchEvent(new Event('change'));
    await step(root, 'Render final cut'); generate(root).click();
    await until(() => runAssembly.mock.calls.length === 1, 'assembly');
    expect(runAssembly.mock.calls[0][0]).toMatchObject({ mixVoice: true, trimToPlanned: true, narrationUrl: expect.stringContaining('cdn.example.com/tts') });
  });

  it('burns captions on demand: gated on narration, confirms cost, uploads the cut, shows the result and a history entry', async () => {
    const root = mount();
    await click(root, 'Use as template');
    await step(root, 'Render final cut'); generate(root).click();
    await until(() => btnText(root, 'Burn captions'), 'captions panel');
    expect(btnText(root, 'Burn captions').disabled).toBe(true); // no narration yet
    await click(root, 'Generate narration');
    await until(() => root.querySelector('audio'), 'narration');
    // narration made after the render is not in the cut: burning would transcribe the clips' own sound, so re-render first
    expect(btnText(root, 'Burn captions').disabled).toBe(true);
    expect(root.textContent).toContain('This cut does not contain the narration');
    await step(root, 'Render again'); generate(root).click();
    await until(() => runAssembly.mock.calls.length === 2 && runAssembly.mock.calls[1][0].mixVoice === true, 're-render with narration');
    await until(() => !btnText(root, 'Burn captions').disabled, 'burn enabled');
    const lang = root.querySelector('select[aria-label="Caption language"]'); lang.value = 'Spanish (Mexico)'; lang.dispatchEvent(new Event('change'));
    const th = root.querySelector('select[aria-label="Caption theme"]'); th.value = 'Beast'; th.dispatchEvent(new Event('change'));
    expect(btnText(root, 'New project').disabled).toBe(false); // idle: reset is available
    window.confirm.mockReturnValueOnce(false);
    btnText(root, 'Burn captions').click(); await tick();
    expect(uploadFile).not.toHaveBeenCalled(); // declined: nothing uploaded or charged
    btnText(root, 'Burn captions').click();
    await until(() => btnText(root, 'Save captioned to library'), 'captioned result');
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(calls.find((c) => c.kind === 'captions')).toMatchObject({ videoUrl: 'https://muapi.example.com/uploaded-cut.mp4', language: 'Spanish (Mexico)', theme: 'Beast' });
    btnText(root, 'Save captioned to library').click(); await tick();
    expect(saveGeneration).toHaveBeenCalledWith(expect.objectContaining({ studio: 'zackd', type: 'video', url: expect.stringContaining('captions') }));
    expect(root.querySelectorAll('#zackd-history-sidebar video')).toHaveLength(1);
    expect(root.querySelector('#zackd-history-sidebar').className).toContain('translate-x-0');
  });

  it('a failed batch shows one clean, visible error under the prompt bar and keeps Redo available', async () => {
    const root = mount();
    typeTopic(root, 'Gum'); await step(root, 'Write script'); generate(root).click();
    await step(root, 'Approve script');
    runJob.mockRejectedValueOnce(new Error('The generation failed. Try again.'));
    const scrollIntoView = vi.fn(); Element.prototype.scrollIntoView = scrollIntoView;
    generate(root).click();
    await until(() => root.querySelector('[role=alert]:not(.hidden)'), 'error');
    const alert = root.querySelector('[role=alert]');
    expect(alert.textContent).toBe('1 of 2 failed: The generation failed. Try again. Use Redo to retry them.');
    expect(alert.textContent).not.toMatch(/\.\./);
    expect(alert.previousElementSibling.querySelector('textarea[data-studio-prompt]')).toBeTruthy(); // directly under the bar
    expect(scrollIntoView).toHaveBeenCalled();
    expect(generate(root).textContent).toContain('Generate 1 character sheet'); // the failed sheet is retried from the same button
    expect(root.querySelector('button[aria-label^="Generate character sheet"], button[aria-label^="Redo"], button[aria-label^="Generate"]')).toBeTruthy();
  });

  it('drops a generated voice-over when the narration text it was made from is edited', async () => {
    const root = mount();
    await click(root, 'Use as template');
    await click(root, 'Generate narration');
    await until(() => root.querySelector('audio'), 'narration');
    const nar = root.querySelector('textarea[aria-label="Narration, beat 1"]');
    nar.value = 'A corrected sentence.'; nar.dispatchEvent(new Event('input')); nar.dispatchEvent(new Event('change'));
    await until(() => !root.querySelector('audio'), 'voice-over dropped');
    expect(btnText(root, 'Generate narration')).toBeTruthy();
  });

  it('offers Rewrite script until the script is approved, so a changed topic can get a new script', async () => {
    const root = mount();
    typeTopic(root, 'Gum'); await step(root, 'Write script'); generate(root).click();
    await until(() => btnText(root, 'Rewrite script'), 'rewrite offered');
    const scriptCalls = () => calls.filter((c) => c.action === 'script').length;
    expect(scriptCalls()).toBe(1);
    typeTopic(root, 'Sleep');
    btnText(root, 'Rewrite script').click();
    await until(() => scriptCalls() === 2, 'second script request');
    expect(calls.filter((c) => c.action === 'script').at(-1).topic).toBe('Sleep');
    await step(root, 'Approve script'); generate(root).click();
    await until(() => !btnText(root, 'Rewrite script'), 'gone once approved');
  });

  it('a recovered job that finishes after the studio was left merges into the latest saved project instead of overwriting it', async () => {
    localStorage.setItem('zackd_project_v1', JSON.stringify({ pid: 'P1', topic: 'Original topic', shots: {} }));
    savePendingJob({ requestId: 'req_late', studioType: 'zackd', historyMeta: { slot: 'clip', id: 'beat_1_a', pid: 'P1' }, maxAttempts: 10, interval: 10, submittedAt: Date.now() });
    let finish;
    vi.mocked(pollJob).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const root = mount();                       // the studio resumes the job and waits for it
    root.cleanup();                             // the user leaves the studio...
    // ...comes back, and edits the project (a newer studio instance saved this; the old instance only has its stale copy)
    localStorage.setItem('zackd_project_v1', JSON.stringify({ pid: 'P1', topic: 'Edited topic', shots: { beat_2_a: { clip: 'https://cdn.example.com/kept.mp4' } } }));
    finish({ url: 'https://cdn.example.com/late-clip.mp4' });
    await tick(40);
    const saved = JSON.parse(localStorage.getItem('zackd_project_v1'));
    expect(saved.topic).toBe('Edited topic');                                            // the user's edit survives
    expect(saved.shots.beat_2_a.clip).toBe('https://cdn.example.com/kept.mp4');          // so does other work
    expect(saved.shots.beat_1_a.clip).toBe('https://cdn.example.com/late-clip.mp4');     // and the recovered clip is added
  });

  it('a studio opened again keeps a result that a disposed studio recovered late, even after the user edits', async () => {
    localStorage.setItem('zackd_project_v1', JSON.stringify({ pid: 'P1', topic: 'Topic', shots: {} }));
    savePendingJob({ requestId: 'req_late2', studioType: 'zackd', historyMeta: { slot: 'clip', id: 'beat_1_a', pid: 'P1' }, maxAttempts: 10, interval: 10, submittedAt: Date.now() });
    let finishOld;
    vi.mocked(pollJob).mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    vi.mocked(pollJob).mockImplementationOnce(() => new Promise(() => {})); // the reopened studio's own poll never ends here
    const old = mount();
    old.cleanup();
    document.body.replaceChildren();
    const fresh = mount();                                    // the user came back; this instance loaded the project BEFORE the late result
    finishOld({ url: 'https://cdn.example.com/late-clip2.mp4' });
    await tick(40);
    typeTopic(fresh, 'Edited after the result');              // the live studio saves its state
    await tick(20);
    const saved = JSON.parse(localStorage.getItem('zackd_project_v1'));
    expect(saved.topic).toBe('Edited after the result');
    expect(saved.shots.beat_1_a.clip).toBe('https://cdn.example.com/late-clip2.mp4'); // the recovered result was not overwritten
  });

  it('a late-recovered clip dropped by a disposed studio also invalidates the live studio\'s finished cut', async () => {
    vi.mocked(pollJob).mockReset(); vi.mocked(pollJob).mockImplementation(async () => ({ url: 'https://cdn.example.com/resumed' })); // drop once-queues left by earlier tests
    const root0 = mount();
    await click(root0, 'Use as template');
    await step(root0, 'Render final cut');
    const pid = JSON.parse(localStorage.getItem('zackd_project_v1')).pid;
    root0.cleanup(); document.body.replaceChildren();
    savePendingJob({ requestId: 'req_late3', studioType: 'zackd', historyMeta: { slot: 'clip', id: 'beat_1_a', pid }, maxAttempts: 10, interval: 10, submittedAt: Date.now() });
    let finishOld;
    vi.mocked(pollJob).mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    vi.mocked(pollJob).mockImplementationOnce(() => new Promise(() => {}));
    const old = mount();
    old.cleanup(); document.body.replaceChildren();
    const live = mount();
    generate(live).click();
    await until(() => btnText(live, 'Download MP4'), 'final cut');
    finishOld({ url: 'https://cdn.example.com/late-clip3.mp4' });
    await tick(40);
    expect(btnText(live, 'Download MP4')).toBeFalsy(); // the cut was built from the replaced clip
  });
});
