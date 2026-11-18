import { describe, it, expect, vi } from 'vitest';
import { buildProjectContext, findTimestamps, parseMentions, buildCutClips, runLlm } from '../timelineLlm.js';
import AIChatPanel from '../../../../components/timeline/AIChatPanel.js';

const clips = [
  { id: 'v1', type: 'video', name: 'Interview', left: 0, width: 50, trimIn: 2, src: 'a.mp4', metadata: { tags: ['person'], description: 'A woman talking' } },
  { id: 'cap', type: 'captions', name: 'Captions', left: 0, width: 50, sourceClipId: 'v1', captions: [{ text: 'Hello', startMs: 0, endMs: 300, speaker: 1 }, { text: ' there.', startMs: 300, endMs: 600 }] },
];
const editor = {
  timelineSeconds: () => 20, playheadSec: () => 1,
  allClips: () => clips, trackOf: () => ({ name: 'Main' }),
  clipStart: (c) => (c.left / 100) * 20, clipDuration: (c) => (c.width / 100) * 20,
};

describe('timeline chat helpers', () => {
  it('builds a context with clips, tags and transcripts', () => {
    const ctx = buildProjectContext(editor, { selectedId: 'v1', markers: [{ t: 3, label: 'beat' }] });
    expect(ctx).toMatch(/v1 \| video \| Main \| 0–10s \| in 2s \| 1x \| Interview \| tags: person; shows: A woman talking \| SELECTED/);
    expect(ctx).toMatch(/\[0s · v1\] Speaker 1: Hello there\./);
    expect(ctx).toMatch(/Markers: 3s "beat"/);
  });
  it('finds timestamps and mentions', () => {
    expect(findTimestamps('at 1:05 and 12.5s and 01:00:02').map((t) => t.time)).toEqual([65, 12.5, 3602]);
    expect(parseMentions('cut @Interview into @tab-2')).toEqual(['Interview', 'tab-2']);
  });
  it('turns a cut list into back-to-back clips with new in-points', () => {
    const out = buildCutClips([{ clip_id: 'v1', in: 4, out: 6, note: 'hook' }, { clip_id: 'nope', in: 0, out: 1 }, { clip_id: 'v1', in: 10, out: 13, note: '' }], (id) => clips.find((c) => c.id === id));
    expect(out.map((p) => [p.start, p.end, p.clip.trimIn])).toEqual([[0, 2, 4], [2, 5, 10]]);
    expect(out[0].clip.id).not.toBe('v1');
  });
  it('needs the user key', async () => {
    await expect(runLlm('chat', {}, { headers: {}, fetchImpl: vi.fn() })).rejects.toThrow(/own OpenAI key/);
  });
});

describe('AIChatPanel', () => {
  it('sends the mode and context, renders citations and applies cuts', async () => {
    const llm = vi.fn(async () => ({ data: { answer: 'Best line at 0:04.', citations: [], cuts: [{ clip_id: 'v1', in: 4, out: 6, note: 'hook' }], edits: [] }, usage: { input_tokens: 3, output_tokens: 2 } }));
    const container = document.createElement('div');
    const seekTo = vi.fn();
    const applyCuts = vi.fn(async () => 'Built tab');
    const panel = new AIChatPanel(container, { tracks: [] }, { getContext: () => 'CTX', seekTo, applyCuts }, { llm });
    expect(container.innerHTML).toContain('AI Assistant');
    panel.setMode('cut');
    container.querySelector('#aiChatInput').value = 'make a 2s hook';
    await panel._sendMessage();
    expect(llm).toHaveBeenCalledWith('chat', expect.objectContaining({ mode: 'cut', context: 'CTX', message: 'make a 2s hook' }));
    container.querySelector('.citation-btn').click();
    expect(seekTo).toHaveBeenCalledWith(4);
    const apply = [...container.querySelectorAll('button')].find((b) => /new timeline tab/.test(b.textContent));
    apply.click();
    await Promise.resolve();
    expect(applyCuts).toHaveBeenCalledWith([{ clip_id: 'v1', in: 4, out: 6, note: 'hook' }]);
    expect(container.querySelector('#aiChatStats').textContent).toMatch(/Tokens: 5/);
  });
  it('shows errors instead of fake answers', async () => {
    const container = document.createElement('div');
    const panel = new AIChatPanel(container, { tracks: [] }, {}, { llm: async () => { throw new Error('Add your OpenAI key'); } });
    container.querySelector('#aiChatInput').value = 'trim the intro';
    await panel._sendMessage();
    expect(container.textContent).toMatch(/Add your OpenAI key/);
    expect(container.textContent).not.toMatch(/Trimmed/);
  });
});
