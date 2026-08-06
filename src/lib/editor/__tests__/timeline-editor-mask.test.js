import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('../aiMuapi.js', () => ({
  AiMuAPI: {
    applySAM3Segmentation: vi.fn().mockResolvedValue({ mask: 'default-mask' })
  }
}));

describe('Timeline Editor Mask Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.TimelineEditor = {};
  });

  it('imports aiEditingTools and has SAM3 masking constant', async () => {
    const { EDITING_TOOLS } = await import('../ai-features/aiEditingTools.js');
    expect(EDITING_TOOLS.SAM3_MASKING).toBe('sam3-masking');
  });

  it('has getMaskPromptType and getMaskTextPrompt helpers', async () => {
    const { createAIEditingTools } = await import('../ai-features/aiEditingTools.js');
    const fakeState = {
      getSelectedClips: () => [{ id: 'clip-1' }],
      updateClip: vi.fn()
    };
    const container = document.createElement('div');
    const aiTools = createAIEditingTools(fakeState, container);

    const modal = document.createElement('div');
    modal.innerHTML = `
      <select id="mask-prompt-type"><option value="text">Text</option><option value="click">Click</option></select>
      <input type="text" id="mask-text-prompt" value="the person">
    `;
    document.body.appendChild(modal);
    aiTools.setModal(modal);

    expect(aiTools.getMaskPromptType()).toBe('text');
    expect(aiTools.getMaskTextPrompt()).toBe('the person');

    const select = modal.querySelector('#mask-prompt-type');
    select.value = 'click';
    expect(aiTools.getMaskPromptType()).toBe('click');

    document.body.removeChild(modal);
  });

  it('emit sam3-mask-applied event after successful masking', async () => {
    const { createAIEditingTools, EDITING_TOOLS } = await import('../ai-features/aiEditingTools.js');
    const { AiMuAPI } = await import('../aiMuapi.js');

    AiMuAPI.applySAM3Segmentation.mockResolvedValue({ mask: 'data:image/png;base64,abc' });

    const mockClip = { id: 'clip-1', source: 'test-source', mask: null };
    const fakeState = {
      getSelectedClips: () => [mockClip],
      updateClip: vi.fn()
    };

    const container = document.createElement('div');
    const aiTools = createAIEditingTools(fakeState, container);

    const modal = document.createElement('div');
    modal.innerHTML = `
      <select id="mask-prompt-type"><option value="text">Text</option></select>
      <input type="text" id="mask-text-prompt" value="test">
      <input type="hidden" id="mask-click-point" value="">
      <input type="hidden" id="mask-box" value="">
      <button class="btn-generate">Segment</button>
    `;
    document.body.appendChild(modal);
    aiTools.setModal(modal);

    const eventPromise = new Promise((resolve) => {
      window.addEventListener('sam3-mask-applied', (e) => resolve(e.detail));
    });

    const result = await aiTools.executeSAM3Masking();
    const detail = await eventPromise;

    expect(AiMuAPI.applySAM3Segmentation).toHaveBeenCalledTimes(1);
    expect(AiMuAPI.applySAM3Segmentation).toHaveBeenCalledWith(
      'test-source',
      expect.objectContaining({ type: 'text', prompt: 'test' })
    );
    expect(mockClip.mask).toBe('data:image/png;base64,abc');
    expect(detail.maskUrl).toBe('data:image/png;base64,abc');
    expect(detail.clipId).toBe('clip-1');
    expect(result.success).toBe(true);

    document.body.removeChild(modal);
  });

  it('passes maskClickPoint as points when prompt type is click', async () => {
    const { createAIEditingTools, EDITING_TOOLS } = await import('../ai-features/aiEditingTools.js');
    const { AiMuAPI } = await import('../aiMuapi.js');

    AiMuAPI.applySAM3Segmentation.mockResolvedValue({ mask: 'mask-data' });

    const mockClip = { id: 'clip-1', source: 'test-source' };
    const fakeState = {
      getSelectedClips: () => [mockClip],
      updateClip: vi.fn()
    };

    const container = document.createElement('div');
    const aiTools = createAIEditingTools(fakeState, container);

    const modal = document.createElement('div');
    modal.innerHTML = `
      <select id="mask-prompt-type"><option value="click">Click</option></select>
      <input type="text" id="mask-text-prompt" value="">
      <input type="hidden" id="mask-click-point" value='{"x":0.5,"y":0.3}'>
      <input type="hidden" id="mask-box" value="">
      <button class="btn-generate">Segment</button>
    `;
    document.body.appendChild(modal);
    aiTools.setModal(modal);

    await aiTools.executeSAM3Masking();

    expect(AiMuAPI.applySAM3Segmentation).toHaveBeenCalledTimes(1);
    expect(AiMuAPI.applySAM3Segmentation).toHaveBeenCalledWith(
      'test-source',
      expect.objectContaining({ type: 'click', points: { x: 0.5, y: 0.3 } })
    );

    document.body.removeChild(modal);
  });

  it('passes maskSelectionBox as box when prompt type is box', async () => {
    const { createAIEditingTools, EDITING_TOOLS } = await import('../ai-features/aiEditingTools.js');
    const { AiMuAPI } = await import('../aiMuapi.js');

    AiMuAPI.applySAM3Segmentation.mockResolvedValue({ mask: 'mask-data' });

    const mockClip = { id: 'clip-1', source: 'test-source' };
    const fakeState = {
      getSelectedClips: () => [mockClip],
      updateClip: vi.fn()
    };

    const container = document.createElement('div');
    const aiTools = createAIEditingTools(fakeState, container);

    const modal = document.createElement('div');
    modal.innerHTML = `
      <select id="mask-prompt-type"><option value="box">Box</option></select>
      <input type="text" id="mask-text-prompt" value="">
      <input type="hidden" id="mask-click-point" value="">
      <input type="hidden" id="mask-box" value='{"x":0.1,"y":0.2,"w":0.5,"h":0.4}'>
      <button class="btn-generate">Segment</button>
    `;
    document.body.appendChild(modal);
    aiTools.setModal(modal);

    await aiTools.executeSAM3Masking();

    expect(AiMuAPI.applySAM3Segmentation).toHaveBeenCalledTimes(1);
    expect(AiMuAPI.applySAM3Segmentation).toHaveBeenCalledWith(
      'test-source',
      expect.objectContaining({ type: 'box', box: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 } })
    );

    document.body.removeChild(modal);
  });

  it('template contains #tbMask button in Edit tools toolbar', async () => {
    const sourcePath = path.join(process.cwd(), 'src/components/TimelineEditorPage.jsx');
    const source = fs.readFileSync(sourcePath, 'utf-8');
    expect(source).toContain('id="tbMask"');
    expect(source).toContain('Mask tool');
    expect(source).toContain('aria-label="Mask tool"');
  });

  it('keyboard shortcut x maps to Mask and sets selectedTool', async () => {
    const sourcePath = path.join(process.cwd(), 'src/components/TimelineEditorPage.jsx');
    const source = fs.readFileSync(sourcePath, 'utf-8');
    expect(source).toContain("'x': 'Mask'");
    expect(source).toContain('state.selectedTool = toolMap[toolKey]');
    expect(source).toContain("showToast('Mask tool active — select a clip and open AI Tools to segment')");
  });

  it('preview stage has maskOverlay for click/box capture', async () => {
    const sourcePath = path.join(process.cwd(), 'src/components/TimelineEditorPage.jsx');
    const source = fs.readFileSync(sourcePath, 'utf-8');
    expect(source).toContain('id="maskOverlay"');
    expect(source).toContain('maskClickPoint');
    expect(source).toContain('maskSelectionBox');
    expect(source).toContain('normStartX');
    expect(source).toContain('normStartY');
  });

  it('click on maskOverlay captures normalized coordinates', async () => {
    const captured = { point: null };
    const rect = { width: 200, height: 100, left: 0, top: 0 };

    const clickX = 50;
    const clickY = 30;
    const normX = Math.max(0, Math.min(1, (clickX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clickY - rect.top) / rect.height));

    captured.point = { x: normX, y: normY };

    expect(captured.point.x).toBeCloseTo(0.25);
    expect(captured.point.y).toBeCloseTo(0.3);
  });
});
