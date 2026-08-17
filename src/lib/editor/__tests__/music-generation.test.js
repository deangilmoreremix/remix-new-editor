import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIEditingTools, EDITING_TOOLS } from '../ai-features/aiEditingTools.js';
import { AiMuAPI } from '../aiMuapi.js';

vi.mock('../aiMuapi.js', () => ({
  AiMuAPI: {
    generateMusic: vi.fn(),
  },
}));

describe('AIEditingTools music generation', () => {
  let container;
  let timelineState;
  let tools;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);

    timelineState = {
      getSelectedClips: vi.fn().mockReturnValue([]),
      addAudioTrack: vi.fn().mockReturnValue({ id: 'audio-1' }),
      _getTracks: vi.fn().mockReturnValue([]),
      tracks: [],
    };

    tools = new AIEditingTools(timelineState).init(container);
  });

  afterEach(() => {
    tools.destroy();
    document.body.removeChild(container);
  });

  function openMusicModal() {
    tools.selectTool(EDITING_TOOLS.GENERATE_MUSIC);
    const modal = tools.getModal();
    expect(modal).not.toBeNull();
    return modal;
  }

  function fillMusicForm(overrides = {}) {
    const modal = tools.getModal();
    const defaults = {
      genre: 'cinematic',
      mood: 'dramatic',
      style: 'synthwave',
      tempo: 'medium',
      instrumental: true,
      durationMode: 'custom',
      customDuration: '45',
    };
    const values = { ...defaults, ...overrides };

    if (modal.querySelector('#music-genre')) modal.querySelector('#music-genre').value = values.genre;
    if (modal.querySelector('#music-mood')) modal.querySelector('#music-mood').value = values.mood;
    if (modal.querySelector('#music-style')) modal.querySelector('#music-style').value = values.style;
    if (modal.querySelector('#music-tempo')) modal.querySelector('#music-tempo').value = values.tempo;
    if (modal.querySelector('#music-instrumental')) modal.querySelector('#music-instrumental').checked = values.instrumental;
    if (modal.querySelector('#music-duration-mode')) modal.querySelector('#music-duration-mode').value = values.durationMode;
    if (modal.querySelector('#music-duration')) modal.querySelector('#music-duration').value = values.customDuration;
  }

  it('maps presets to generateMusic parameters', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 45 });

    timelineState.getSelectedClips.mockReturnValue([]);
    const modal = openMusicModal();
    fillMusicForm({ genre: 'upbeat', mood: 'energetic', style: 'lofi', tempo: 'slow', instrumental: false, customDuration: '60' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    expect(AiMuAPI.generateMusic).toHaveBeenCalledTimes(1);
    const callArgs = AiMuAPI.generateMusic.mock.calls[0][0];
    expect(callArgs.genre).toBe('upbeat');
    expect(callArgs.mood).toBe('energetic');
    expect(callArgs.style).toBe('lofi');
    expect(callArgs.duration).toBe(60);
    expect(callArgs.instrumental).toBe(false);
    expect(callArgs.prompt).toContain('upbeat');
    expect(callArgs.prompt).toContain('energetic');
    expect(callArgs.prompt).toContain('lofi');
    expect(callArgs.prompt).toContain('tempo: slow');
    expect(callArgs.prompt).not.toContain('instrumental');
  });

  it('snaps duration to selected clip when mode is selected', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 12.5 });

    timelineState.getSelectedClips.mockReturnValue([
      { id: 'clip-1', name: 'Intro', type: 'video', duration: 12.5, start: 0, end: 12.5 },
    ]);

    const modal = openMusicModal();
    fillMusicForm({ durationMode: 'selected', customDuration: '30' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    const callArgs = AiMuAPI.generateMusic.mock.calls[0][0];
    expect(callArgs.duration).toBe(12.5);
  });

  it('snaps duration to timeline total when mode is timeline', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 90 });

    timelineState.getSelectedClips.mockReturnValue([]);
    timelineState._getTracks.mockReturnValue([
      {
        items: [
          { id: 'c1', start: 0, duration: 30, end: 30 },
          { id: 'c2', start: 30, duration: 60, end: 90 },
        ],
      },
    ]);

    const modal = openMusicModal();
    fillMusicForm({ durationMode: 'timeline', customDuration: '30' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    const callArgs = AiMuAPI.generateMusic.mock.calls[0][0];
    expect(callArgs.duration).toBe(90);
  });

  it('uses custom duration when mode is custom', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 45 });

    timelineState.getSelectedClips.mockReturnValue([]);
    timelineState._getTracks.mockReturnValue([]);

    const modal = openMusicModal();
    fillMusicForm({ durationMode: 'custom', customDuration: '45' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    const callArgs = AiMuAPI.generateMusic.mock.calls[0][0];
    expect(callArgs.duration).toBe(45);
  });

  it('builds video context prompt for video clips', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 30 });

    timelineState.getSelectedClips.mockReturnValue([
      { id: 'clip-1', name: 'Hero Scene', type: 'video', duration: 10, start: 0, end: 10 },
    ]);

    const modal = openMusicModal();
    fillMusicForm({ durationMode: 'custom', customDuration: '30' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    const callArgs = AiMuAPI.generateMusic.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Music for video scene: Hero Scene');
  });

  it('builds generic clip prompt for non-video selected clips', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 30 });

    timelineState.getSelectedClips.mockReturnValue([
      { id: 'clip-1', name: 'VO Take 1', type: 'audio', duration: 10, start: 0, end: 10 },
    ]);

    const modal = openMusicModal();
    fillMusicForm({ durationMode: 'custom', customDuration: '30' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    const callArgs = AiMuAPI.generateMusic.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Music for clip: VO Take 1');
  });

  it('falls back to default duration when no clips and no timeline duration', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 30 });

    timelineState.getSelectedClips.mockReturnValue([]);
    timelineState._getTracks.mockReturnValue([]);

    const modal = openMusicModal();
    fillMusicForm({ durationMode: 'custom', customDuration: '5' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    const callArgs = AiMuAPI.generateMusic.mock.calls[0][0];
    expect(callArgs.duration).toBe(10);
  });

  it('creates audio clip and adds it to audio track', async () => {
    AiMuAPI.generateMusic.mockResolvedValue({ url: 'https://cdn.example.com/song.mp3', duration: 45 });

    timelineState.getSelectedClips.mockReturnValue([]);

    const modal = openMusicModal();
    fillMusicForm({ durationMode: 'custom', customDuration: '45' });

    await tools.executeTool(EDITING_TOOLS.GENERATE_MUSIC);

    expect(timelineState.addAudioTrack).toHaveBeenCalledTimes(1);
    const audioClipArg = timelineState.addAudioTrack.mock.calls[0][0];
    expect(audioClipArg.type).toBe('audio');
    expect(audioClipArg.duration).toBe(45);
    expect(audioClipArg.url).toBe('https://cdn.example.com/song.mp3');
  });
});

describe('AIEditingTools music prompt builder', () => {
  let tools;

  beforeEach(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    tools = new AIEditingTools({ getSelectedClips: () => [], _getTracks: () => [], tracks: [] }).init(container);
  });

  afterEach(() => {
    tools.destroy();
  });

  it('includes all fields in prompt when provided', () => {
    const prompt = tools.buildMusicPrompt({
      genre: 'cinematic',
      mood: 'dramatic',
      style: 'orchestral',
      tempo: 'slow',
      instrumental: true,
      videoContext: 'Music for video scene: Hero',
    });
    expect(prompt).toBe('Music for video scene: Hero. cinematic dramatic music. style: orchestral. tempo: slow. instrumental.');
  });

  it('omits style and video context when empty', () => {
    const prompt = tools.buildMusicPrompt({
      genre: 'ambient',
      mood: 'calm',
      style: '',
      tempo: 'medium',
      instrumental: false,
      videoContext: '',
    });
    expect(prompt).toBe('ambient calm music. tempo: medium.');
    expect(prompt).not.toContain('style:');
    expect(prompt).not.toContain('instrumental');
  });
});
