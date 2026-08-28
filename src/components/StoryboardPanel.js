/**
 * StoryboardPanel — storyboard editor surface for the Director page.
 *
 * Uses the existing DirectorAgentRuntime (src/lib/directorAgentRuntime.js) for
 * state, palette generation, and project knowledge. Frames are rendered with
 * the same createFrameVisual gradient pattern the React reference uses.
 *
 * The panel is mountable: pass `appendTo: el` to inject into an existing DOM
 * node, or call StoryboardPanel() standalone to get a fresh surface.
 */

import {
  directorRuntime,
  STORYBOARD_PRESETS,
  SHOT_TYPES,
  AGENTS,
  QUICK_ACTIONS,
} from '../lib/directorAgentRuntime.js';
import { showToast } from '../lib/loading.js';
import { createStudioButton } from '../lib/studioButton.js';

// Inline frame visual: same gradient pattern used in the React reference.
// Kept local to this panel so we don't introduce a new shared file.
function createFrameVisual(frame, large = false) {
  const palette = (frame && frame.palette) || ['#0f172a', '#020617', '#38bdf8'];
  const [c1, c2, c3] = palette;
  const el = document.createElement('div');
  el.className = `relative overflow-hidden rounded-2xl border border-white/10 ${large ? 'aspect-video' : 'aspect-[16/10]'}`;
  el.style.background = `radial-gradient(circle at 28% 24%, ${c3}33, transparent 28%), radial-gradient(circle at 70% 72%, rgba(16,185,129,0.18), transparent 24%), linear-gradient(135deg, ${c1} 0%, ${c2} 62%, #000 100%)`;
  el.innerHTML = `
    <div class="absolute inset-0 pointer-events-none" style="background-image: linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px); background-size: 40px 40px;"></div>
    <div class="absolute top-3 left-3 text-[10px] uppercase tracking-widest text-white/70 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">${escapeHtml(frame?.shot || 'Wide Shot')}</div>
    <div class="absolute bottom-3 left-3 right-3 text-xs text-white/90 line-clamp-3">${escapeHtml(frame?.prompt || '')}</div>
  `;
  return el;
}

export function StoryboardPanel({ appendTo } = {}) {
  const root = document.createElement('div');
  root.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-5';

  // ───────────────────────────────────────────────────────────────────────
  // Subscribe to runtime state
  // ───────────────────────────────────────────────────────────────────────
  let state = {
    frames: directorRuntime.frames || [],
    selectedFrameId: directorRuntime.selectedFrameId || (directorRuntime.frames?.[0]?.id ?? 1),
    currentPreset: directorRuntime.currentPreset || STORYBOARD_PRESETS[0],
    chatInput: '',
  };

  function syncFromRuntime() {
    state.frames = directorRuntime.frames || state.frames;
    state.selectedFrameId = directorRuntime.selectedFrameId || state.selectedFrameId;
    state.currentPreset = directorRuntime.currentPreset || state.currentPreset;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────
  function render() {
    syncFromRuntime();
    const selected = state.frames.find((f) => f.id === state.selectedFrameId) || state.frames[0];

    root.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <h2 class="text-lg font-black text-white">Storyboard</h2>
        <span class="text-xs text-muted px-2 py-0.5 rounded-full bg-white/5">${state.frames.length} frames</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Left: controls + frame list -->
        <div class="space-y-3">
          <div>
            <label class="text-xs text-muted font-bold block mb-1">Preset</label>
            <select id="sb-preset" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
              ${STORYBOARD_PRESETS.map((p) => `<option value="${p.id}" ${state.currentPreset?.id === p.id ? 'selected' : ''}>${p.label} · ${p.aspectRatio}</option>`).join('')}
            </select>
          </div>

          <div class="flex gap-2">
            <button id="sb-add" class="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white">+ Frame</button>
            <button id="sb-generate" class="btn-generate flex-1">🎞️ Generate</button>
          </div>

          <div class="space-y-2 max-h-[420px] overflow-y-auto pr-1" id="sb-frame-list">
            ${state.frames.map((f) => frameCard(f, state.selectedFrameId === f.id)).join('')}
          </div>
        </div>

        <!-- Center: preview + frame editor -->
        <div class="md:col-span-2 space-y-3">
          ${selected ? `
            <div id="sb-preview"></div>
            <div>
              <label class="text-xs text-muted font-bold block mb-1">Shot type</label>
              <div class="flex flex-wrap gap-2">
                ${SHOT_TYPES.map((s) => `<button data-shot="${s}" class="sb-shot px-2.5 py-1 rounded-full text-xs ${f.shot === s ? 'bg-primary text-black font-bold' : 'bg-white/5 text-white border border-white/10'}">${s}</button>`).join('')}
              </div>
            </div>
            <div>
              <label class="text-xs text-muted font-bold block mb-1">Prompt</label>
              <textarea id="sb-prompt" rows="3" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none">${escapeHtml(f.prompt || '')}</textarea>
            </div>
            <div>
              <label class="text-xs text-muted font-bold block mb-1">Narration</label>
              <input id="sb-narration" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30" value="${escapeAttr(f.narration || '')}" />
            </div>
          ` : `
            <div class="text-secondary text-sm italic p-6 bg-white/5 rounded-xl text-center">No frames yet. Click + Frame to add one.</div>
          `}
        </div>
      </div>

      <div class="mt-4 border-t border-white/10 pt-4">
        <div class="text-xs text-muted font-bold mb-2">Quick actions</div>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
          ${QUICK_ACTIONS.slice(0, 10).map((q) => `<button class="sb-quick p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left"><div class="text-xs text-white font-bold">${q.icon} ${q.title}</div><div class="text-[10px] text-muted">${q.desc}</div></button>`).join('')}
        </div>
      </div>
    `;
    const genBtn = createStudioButton({ text: 'Generate', emoji: '🎞️', variant: 'primary', className: 'flex-1 w-auto' });
    genBtn.id = 'sb-generate';
    const existingGenBtn = root.querySelector('#sb-generate');
    if (existingGenBtn) {
      existingGenBtn.replaceWith(genBtn);
    }
    bind();
    // Render the large frame preview
    if (selected) {
      const previewSlot = root.querySelector('#sb-preview');
      if (previewSlot) previewSlot.appendChild(createFrameVisual(selected, true));
    }
  }

  function frameCard(f, isSelected) {
    return `
      <button data-frame="${f.id}" class="sb-frame w-full text-left p-2 rounded-xl flex items-center gap-2 ${isSelected ? 'bg-white/10 border border-primary/30' : 'bg-white/5 border border-white/5 hover:bg-white/10'}">
        <div class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">${frameThumb(f)}</div>
        <div class="flex-1 min-w-0">
          <div class="text-xs text-white font-bold truncate">${f.shot || 'Wide Shot'} · #${f.id}</div>
          <div class="text-[10px] text-muted truncate">${escapeHtml((f.prompt || '').slice(0, 40))}</div>
        </div>
        <button data-remove="${f.id}" class="sb-remove text-muted hover:text-red-300 text-sm">✕</button>
      </button>
    `;
  }

  function frameThumb(f) {
    const palette = f.palette || ['#0f172a', '#020617', '#38bdf8'];
    const [c1, c2, c3] = palette;
    return `<div class="w-12 h-12" style="background: radial-gradient(circle at 28% 24%, ${c3}33, transparent 28%), radial-gradient(circle at 70% 72%, rgba(16,185,129,0.18), transparent 24%), linear-gradient(135deg, ${c1} 0%, ${c2} 62%, #000 100%);"></div>`;
  }

  function bind() {
    const presetSel = root.querySelector('#sb-preset');
    if (presetSel) presetSel.onchange = (e) => {
      const next = STORYBOARD_PRESETS.find((p) => p.id === e.target.value) || STORYBOARD_PRESETS[0];
      directorRuntime.setPreset(next);
      state.currentPreset = next;
      render();
    };
    const addBtn = root.querySelector('#sb-add');
    if (addBtn) addBtn.onclick = () => {
      const id = Math.max(0, ...state.frames.map((f) => f.id)) + 1;
      const newFrame = { id, shot: 'Wide Shot', prompt: 'New frame prompt', narration: '', palette: ['#0f172a', '#020617', '#38bdf8'] };
      directorRuntime.frames = [...state.frames, newFrame];
      directorRuntime.selectedFrameId = id;
      directorRuntime.notifyStateChange?.();
      render();
    };
    const genBtn = root.querySelector('#sb-generate');
    if (genBtn) genBtn.onclick = async () => {
      try {
        showToast('Generating frames…', 'info');
        await directorRuntime.generateAllFrames();
        render();
        showToast('Storyboard generated', 'success');
      } catch (e) {
        showToast(`Generation failed: ${e.message}`, 'error');
      }
    };
    root.querySelectorAll('.sb-frame').forEach((btn) => {
      btn.onclick = (e) => {
        if (e.target.closest('.sb-remove')) return;
        const id = Number(btn.dataset.frame);
        directorRuntime.selectedFrameId = id;
        state.selectedFrameId = id;
        render();
      };
    });
    root.querySelectorAll('.sb-remove').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.remove);
        directorRuntime.frames = state.frames.filter((f) => f.id !== id);
        if (directorRuntime.selectedFrameId === id) directorRuntime.selectedFrameId = directorRuntime.frames[0]?.id;
        directorRuntime.notifyStateChange?.();
        render();
      };
    });
    root.querySelectorAll('.sb-shot').forEach((btn) => {
      btn.onclick = () => {
        const shot = btn.dataset.shot;
        const f = state.frames.find((x) => x.id === state.selectedFrameId);
        if (!f) return;
        f.shot = shot;
        directorRuntime.frames = [...state.frames];
        directorRuntime.notifyStateChange?.();
        render();
      };
    });
    const promptEl = root.querySelector('#sb-prompt');
    if (promptEl) promptEl.oninput = (e) => {
      const f = state.frames.find((x) => x.id === state.selectedFrameId);
      if (f) {
        f.prompt = e.target.value;
        directorRuntime.frames = [...state.frames];
      }
    };
    const narrationEl = root.querySelector('#sb-narration');
    if (narrationEl) narrationEl.oninput = (e) => {
      const f = state.frames.find((x) => x.id === state.selectedFrameId);
      if (f) {
        f.narration = e.target.value;
        directorRuntime.frames = [...state.frames];
      }
    };
    root.querySelectorAll('.sb-quick').forEach((btn, i) => {
      btn.onclick = async () => {
        const action = QUICK_ACTIONS[i];
        if (!action) return;
        try {
          await directorRuntime.executeAgentCommand?.(
            mapQuickActionToAgent(action.title),
            { prompt: state.frames.map((f) => f.prompt).join(' '), videoId: directorRuntime.videoId }
          );
          showToast(`${action.title} dispatched`, 'success');
        } catch (e) {
          showToast(`Failed: ${e.message}`, 'error');
        }
      };
    });
  }

  function mapQuickActionToAgent(title) {
    const map = {
      'Summarize': 'summarizer',
      'Extract Highlights': 'highlighter',
      'Detect Scenes': 'scenes',
      'Add Subtitles': 'subtitler',
      'Dub Video': 'dubbing',
      'Add B-Roll': 'broll',
      'Voiceover': 'voiceover',
      'Create Shorts': 'social',
      'Color Correction': 'color',
      'Stabilize': 'stabilize',
    };
    return map[title] || 'editor';
  }

  // Reference unused import to avoid lint complaints
  void AGENTS;

  render();

  if (appendTo) {
    appendTo.appendChild(root);
  }

  root.cleanup = () => {};
  return root;
}

export default StoryboardPanel;

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}
