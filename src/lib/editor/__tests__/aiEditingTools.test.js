import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIEditingTools, EDITING_TOOLS, createAIEditingTools } from '../ai-features/aiEditingTools.js';
import { fillGap } from '../ai-features/fillExtendTools.js';
import { extendClip } from '../ai-features/fillExtendTools.js';

vi.mock('../ai-features/fillExtendTools.js', () => ({
  fillGap: vi.fn(),
  extendClip: vi.fn(),
}));

vi.mock('../aiMuapi.js', () => ({
  AiMuAPI: {
    generateVideo: vi.fn().mockRejectedValue(new Error('no-api-key')),
    generateImage: vi.fn(),
    generateMusic: vi.fn(),
    applySAM3Segmentation: vi.fn(),
  },
}));

describe('AIEditingTools - model dropdown', () => {
  let container;
  let tools;

  const VERIFIED_MODEL_IDS = [
    'seedance-2.5-first-last-frame',
    'minimax-h3-open-image-to-video',
    'vidu-q2-turbo-start-end-video',
    'vidu-q2-pro-start-end-video',
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    tools?.destroy();
    container.remove();
  });

  function createTools(timelineState) {
    tools = createAIEditingTools(
      timelineState || {
        getState: () => ({ tracks: [] }),
        getSelectedClips: () => [],
      },
      container
    );
    return tools;
  }

  describe('Fill Gap modal', () => {
    it('contains a model dropdown with the expected options', () => {
      createTools();
      tools.selectTool(EDITING_TOOLS.FILL_GAP);
      const modal = tools.getModal();
      expect(modal).not.toBeNull();

      const select = modal.querySelector('#fill-extend-model');
      expect(select).not.toBeNull();
      expect(select.tagName).toBe('SELECT');

      const options = Array.from(select.options).map(o => o.value);
      expect(options).toEqual(VERIFIED_MODEL_IDS);
    });

    it('defaults to seedance-2.5-first-last-frame', () => {
      createTools();
      tools.selectTool(EDITING_TOOLS.FILL_GAP);
      const select = tools.getModal().querySelector('#fill-extend-model');
      expect(select.value).toBe('seedance-2.5-first-last-frame');
    });

    it('passes the selected model to fillGap when Generate is clicked', async () => {
      fillGap.mockResolvedValue({ success: true, clipId: 'clip-new' });

      const timelineState = {
        getState: () => ({
          tracks: [
            {
              id: 't1',
              clips: [
                { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
                { id: 'c2', start: 15, end: 25, thumbnail: 'https://thumb2.png' },
              ],
            },
          ],
        }),
        getSelectedClips: () => [
          { id: 'c1', trackId: 't1', end: 10 },
          { id: 'c2', trackId: 't1', start: 15 },
        ],
      };
      createTools(timelineState);
      tools.selectTool(EDITING_TOOLS.FILL_GAP);

      const select = tools.getModal().querySelector('#fill-extend-model');
      select.value = 'minimax-h3-open-image-to-video';

      const generateBtn = tools.getModal().querySelector('.btn-generate');
      generateBtn.click();
      // wait for async executeFillGap
      await new Promise(r => setTimeout(r, 0));

      expect(fillGap).toHaveBeenCalledWith(
        expect.anything(),
        't1',
        10,
        15,
        expect.objectContaining({ model: 'minimax-h3-open-image-to-video' })
      );
    });
  });

  describe('Extend Clip modal', () => {
    it('contains a model dropdown with the expected options', () => {
      createTools();
      tools.selectTool(EDITING_TOOLS.EXTEND_CLIP);
      const modal = tools.getModal();
      expect(modal).not.toBeNull();

      const select = modal.querySelector('#fill-extend-model');
      expect(select).not.toBeNull();
      expect(select.tagName).toBe('SELECT');

      const options = Array.from(select.options).map(o => o.value);
      expect(options).toEqual(VERIFIED_MODEL_IDS);
    });

    it('defaults to seedance-2.5-first-last-frame', () => {
      createTools();
      tools.selectTool(EDITING_TOOLS.EXTEND_CLIP);
      const select = tools.getModal().querySelector('#fill-extend-model');
      expect(select.value).toBe('seedance-2.5-first-last-frame');
    });

    it('passes the selected model to extendClip when Generate is clicked', async () => {
      extendClip.mockResolvedValue({ success: true, clipId: 'clip-ext' });

      const timelineState = {
        getState: () => ({
          tracks: [
            {
              id: 't1',
              clips: [
                { id: 'c1', start: 0, end: 10, thumbnail: 'https://thumb1.png' },
              ],
            },
          ],
        }),
        getSelectedClips: () => [{ id: 'c1', trackId: 't1' }],
      };
      createTools(timelineState);
      tools.selectTool(EDITING_TOOLS.EXTEND_CLIP);

      const select = tools.getModal().querySelector('#fill-extend-model');
      select.value = 'vidu-q2-turbo-start-end-video';

      const generateBtn = tools.getModal().querySelector('.btn-generate');
      generateBtn.click();
      await new Promise(r => setTimeout(r, 0));

      expect(extendClip).toHaveBeenCalledWith(
        expect.anything(),
        'c1',
        'after',
        expect.objectContaining({ model: 'vidu-q2-turbo-start-end-video' })
      );
    });
  });
});
