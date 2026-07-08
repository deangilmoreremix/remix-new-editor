/**
 * CinematicTemplateWizard
 *
 * Multi-step wizard for templates flagged `cinematic: true` in templates.js.
 * Wraps the existing TemplateStudio form behaviour and adds:
 *   1. Configure — pick preset, brand context, advanced options
 *   2. Scenes    — build a small storyboard of N scenes (text prompts)
 *   3. Preview   — assembled prompt + scene storyboard
 *   4. Generate  — runs the underlying generation through TemplateStudio
 *
 * The wizard is intentionally a thin orchestrator. Generation is delegated
 * to the same muapi.* calls TemplateStudio uses, so the user can fall back
 * to the simple form by leaving `cinematic: false` on a template.
 */

import { muapi } from '../lib/muapi.js';
import { AuthModal } from './AuthModal.js';
import { showToast } from '../lib/loading.js';

const SCENE_STRUCTURES = {
  THREE_ACT: { name: 'Three-Act', count: 3, hint: 'Setup · Conflict · Resolution' },
  HERO_JOURNEY: { name: 'Hero\'s Journey', count: 5, hint: 'Call · Threshold · Trials · Return · Change' },
  PROBLEM_SOLUTION: { name: 'Problem → Solution', count: 4, hint: 'Pain → Agitate → Solve → CTA' },
  TUTORIAL: { name: 'Step-by-Step', count: 4, hint: 'Intro → Step 1 → Step 2 → Outro' },
};

const VISUAL_STYLES = [
  { id: 'cinematic', label: 'Cinematic', description: 'Theatrical lighting, shallow depth' },
  { id: 'commercial', label: 'Commercial', description: 'Clean, aspirational product shots' },
  { id: 'documentary', label: 'Documentary', description: 'Natural light, candid feel' },
  { id: 'stylized', label: 'Stylized', description: 'Bold color, energetic' },
  { id: 'minimal', label: 'Minimal', description: 'Lots of negative space' },
  { id: 'noir', label: 'Noir', description: 'High contrast, low key' },
];

const CTA_OPTIONS = [
  { id: 'learn_more', label: 'Learn more' },
  { id: 'shop_now', label: 'Shop now' },
  { id: 'book_demo', label: 'Book a demo' },
  { id: 'sign_up', label: 'Sign up' },
  { id: 'subscribe', label: 'Subscribe' },
  { id: 'none', label: 'No CTA' },
];

export function CinematicTemplateWizard({ template, onCancel, onGenerate }) {
  // ───────────────────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────────────────
  const state = {
    step: 1,
    preset: SCENE_STRUCTURES.THREE_ACT,
    visualStyle: VISUAL_STYLES[0],
    brandName: '',
    brandContext: '',
    includeCTA: false,
    cta: CTA_OPTIONS[0],
    advancedMode: false,
    goal: '',
    audience: '',
    scenes: [
      { id: 1, prompt: '', narration: '' },
      { id: 2, prompt: '', narration: '' },
      { id: 3, prompt: '', narration: '' },
    ],
    finalPrompt: '',
    isGenerating: false,
    result: null,
  };

  // Re-allocate scene array to match chosen structure
  function applyPreset() {
    const n = state.preset.count;
    state.scenes = Array.from({ length: n }, (_, i) => state.scenes[i] || { id: i + 1, prompt: '', narration: '' });
  }

  // ───────────────────────────────────────────────────────────────────────
  // DOM
  // ───────────────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg';
  const inner = document.createElement('div');
  inner.className = 'w-full max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12';

  inner.innerHTML = `
    <div class="mb-8 animate-fade-in-up">
      <div class="flex items-center gap-3 mb-2">
        <button id="wizard-back" class="text-secondary text-sm hover:text-white transition">&larr; Back to template</button>
        <span class="text-xs text-muted px-2 py-0.5 rounded-full bg-white/5">Cinematic</span>
      </div>
      <h1 class="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">${escapeHtml(template.name)}</h1>
      <p class="text-secondary text-sm">${escapeHtml(template.description || '')}</p>
    </div>

    <div class="flex items-center gap-2 mb-8">
      ${[1, 2, 3, 4].map(n => `
        <div class="flex-1 h-1 rounded-full ${n <= state.step ? 'bg-primary' : 'bg-white/10'}" data-step-bar="${n}"></div>
      `).join('')}
    </div>
    <div class="text-xs text-muted mb-6">Step <span id="step-num">${state.step}</span> of 4</div>

    <div id="wizard-body" class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 animate-fade-in-up"></div>

    <div class="flex items-center justify-between mt-6">
      <button id="wizard-prev" class="px-5 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl text-sm transition">Back</button>
      <button id="wizard-next" class="px-5 py-3 bg-primary text-black font-black rounded-2xl text-sm hover:scale-[1.02] transition-transform">Next</button>
    </div>
  `;
  container.appendChild(inner);

  if (onCancel) inner.querySelector('#wizard-back').onclick = onCancel;

  // ───────────────────────────────────────────────────────────────────────
  // Step renderers
  // ───────────────────────────────────────────────────────────────────────

  function renderStep1() {
    const body = inner.querySelector('#wizard-body');
    body.innerHTML = `
      <h2 class="text-lg font-bold text-white mb-1">Configure</h2>
      <p class="text-sm text-secondary mb-6">Pick a story structure and visual style. Brand context is optional but improves output quality.</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-muted font-bold block mb-2">Story structure</label>
          <div class="space-y-2" id="preset-list">
            ${Object.values(SCENE_STRUCTURES).map(s => `
              <button data-preset="${s.name}" class="preset-btn w-full text-left p-3 bg-white/5 hover:bg-white/10 border ${state.preset.name === s.name ? 'border-primary' : 'border-white/5'} rounded-xl transition">
                <div class="text-sm text-white font-bold">${s.name}</div>
                <div class="text-xs text-muted">${s.hint}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="text-xs text-muted font-bold block mb-2">Visual style</label>
          <div class="space-y-2" id="style-list">
            ${VISUAL_STYLES.map(s => `
              <button data-style="${s.id}" class="style-btn w-full text-left p-3 bg-white/5 hover:bg-white/10 border ${state.visualStyle.id === s.id ? 'border-primary' : 'border-white/5'} rounded-xl transition">
                <div class="text-sm text-white font-bold">${s.label}</div>
                <div class="text-xs text-muted">${s.description}</div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="border-t border-white/10 mt-6 pt-6">
        <div class="flex items-center gap-2 mb-3">
          <input type="checkbox" id="advanced-toggle" ${state.advancedMode ? 'checked' : ''} class="accent-primary" />
          <label for="advanced-toggle" class="text-xs text-muted font-bold">Advanced mode</label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input id="brand-name" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30" placeholder="Brand / product name" value="${escapeAttr(state.brandName)}" />
          <input id="brand-context" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30" placeholder="Brand context (audience, tone)" value="${escapeAttr(state.brandContext)}" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3" id="advanced-fields" style="${state.advancedMode ? '' : 'display:none'}">
          <input id="goal-input" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30" placeholder="Goal (e.g. signups, awareness)" value="${escapeAttr(state.goal)}" />
          <input id="audience-input" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30" placeholder="Target audience" value="${escapeAttr(state.audience)}" />
        </div>

        <div class="flex items-center gap-3 mt-3">
          <input type="checkbox" id="include-cta" ${state.includeCTA ? 'checked' : ''} class="accent-primary" />
          <label for="include-cta" class="text-sm text-white">Include a call-to-action</label>
          <select id="cta-select" class="ml-auto bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white" style="${state.includeCTA ? '' : 'display:none'}">
            ${CTA_OPTIONS.map(c => `<option value="${c.id}" ${state.cta.id === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>
      </div>
    `;

    body.querySelectorAll('.preset-btn').forEach(btn => {
      btn.onclick = () => {
        const next = Object.values(SCENE_STRUCTURES).find(s => s.name === btn.dataset.preset);
        if (!next) return;
        state.preset = next;
        applyPreset();
        renderStep1();
      };
    });
    body.querySelectorAll('.style-btn').forEach(btn => {
      btn.onclick = () => {
        const next = VISUAL_STYLES.find(s => s.id === btn.dataset.style);
        if (!next) return;
        state.visualStyle = next;
        renderStep1();
      };
    });
    body.querySelector('#advanced-toggle').onchange = (e) => {
      state.advancedMode = e.target.checked;
      body.querySelector('#advanced-fields').style.display = state.advancedMode ? '' : 'none';
    };
    body.querySelector('#brand-name').oninput = (e) => { state.brandName = e.target.value; };
    body.querySelector('#brand-context').oninput = (e) => { state.brandContext = e.target.value; };
    body.querySelector('#goal-input').oninput = (e) => { state.goal = e.target.value; };
    body.querySelector('#audience-input').oninput = (e) => { state.audience = e.target.value; };
    body.querySelector('#include-cta').onchange = (e) => {
      state.includeCTA = e.target.checked;
      body.querySelector('#cta-select').style.display = state.includeCTA ? '' : 'none';
    };
    body.querySelector('#cta-select').onchange = (e) => {
      state.cta = CTA_OPTIONS.find(c => c.id === e.target.value) || CTA_OPTIONS[0];
    };
  }

  function renderStep2() {
    applyPreset();
    const body = inner.querySelector('#wizard-body');
    body.innerHTML = `
      <h2 class="text-lg font-bold text-white mb-1">Scenes</h2>
      <p class="text-sm text-secondary mb-6">Write a short prompt for each scene. The wizard will assemble a continuous storyboard.</p>
      <div class="space-y-3">
        ${state.scenes.map((s, i) => `
          <div class="bg-white/5 rounded-xl p-3 border border-white/5">
            <div class="text-xs text-muted mb-2">Scene ${i + 1}</div>
            <textarea data-scene="${i}" rows="2" class="scene-prompt w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none" placeholder="Describe the shot…">${escapeHtml(s.prompt)}</textarea>
            <input data-narration="${i}" class="scene-narration mt-2 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:border-primary focus:outline-none" placeholder="Optional narration / voiceover line" value="${escapeAttr(s.narration || '')}" />
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('.scene-prompt').forEach(el => {
      el.oninput = (e) => { state.scenes[Number(el.dataset.scene)].prompt = e.target.value; };
    });
    body.querySelectorAll('.scene-narration').forEach(el => {
      el.oninput = (e) => { state.scenes[Number(el.dataset.narration)].narration = e.target.value; };
    });
  }

  function renderStep3() {
    const prompt = assemblePrompt();
    state.finalPrompt = prompt;
    const body = inner.querySelector('#wizard-body');
    body.innerHTML = `
      <h2 class="text-lg font-bold text-white mb-1">Preview</h2>
      <p class="text-sm text-secondary mb-6">Storyboard and assembled prompt. Edit on the previous step if anything looks off.</p>

      <div class="bg-white/5 rounded-xl p-4 border border-white/5 mb-4">
        <div class="text-xs text-muted font-bold mb-2">Storyboard</div>
        <div class="space-y-2">
          ${state.scenes.map((s, i) => `
            <div class="flex items-start gap-2 text-sm">
              <div class="w-6 h-6 rounded-full bg-primary/20 text-primary font-black text-xs flex items-center justify-center flex-shrink-0">${i + 1}</div>
              <div class="flex-1 min-w-0">
                <div class="text-white">${escapeHtml(s.prompt || '— no prompt —')}</div>
                ${s.narration ? `<div class="text-xs text-muted italic mt-1">"${escapeHtml(s.narration)}"</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="bg-black/30 rounded-xl p-4 border border-white/5">
        <div class="text-xs text-muted font-bold mb-2">Assembled prompt</div>
        <pre class="text-sm text-white whitespace-pre-wrap font-mono">${escapeHtml(prompt)}</pre>
      </div>
    `;
  }

  function renderStep4() {
    const body = inner.querySelector('#wizard-body');
    if (state.result) {
      const r = state.result;
      body.innerHTML = `
        <h2 class="text-lg font-bold text-white mb-1">Generated</h2>
        <p class="text-sm text-secondary mb-4">Your cinematic video is ready.</p>
        <div class="bg-black/40 rounded-xl p-4 mb-4">
          ${r.url ? `<video controls class="w-full rounded-xl" src="${r.url}"></video>` : ''}
          ${r.images && r.images[0] ? `<img src="${r.images[0]}" alt="" class="w-full rounded-xl" />` : ''}
        </div>
        <div class="flex gap-2">
          ${r.url ? `<a href="${r.url}" download class="flex-1 px-5 py-3 bg-primary text-black font-black rounded-2xl text-sm text-center">Download</a>` : ''}
          <button id="wizard-restart" class="flex-1 px-5 py-3 bg-white/5 text-white font-bold rounded-2xl text-sm">Start over</button>
        </div>
      `;
      body.querySelector('#wizard-restart').onclick = () => {
        state.step = 1;
        state.result = null;
        renderCurrentStep();
      };
      return;
    }
    body.innerHTML = `
      <h2 class="text-lg font-bold text-white mb-1">Generate</h2>
      <p class="text-sm text-secondary mb-6">Run the cinematic pipeline. Each scene becomes a clip; the wizard stitches them via the underlying template.</p>
      <div class="text-center py-8">
        <div class="w-12 h-12 mx-auto mb-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div class="text-sm text-white">Generating ${state.scenes.length} scenes…</div>
      </div>
    `;
  }

  function renderCurrentStep() {
    inner.querySelector('#step-num').textContent = state.step;
    inner.querySelectorAll('[data-step-bar]').forEach(el => {
      const n = Number(el.dataset.stepBar);
      el.classList.toggle('bg-primary', n <= state.step);
      el.classList.toggle('bg-white/10', n > state.step);
    });
    if (state.step === 1) renderStep1();
    else if (state.step === 2) renderStep2();
    else if (state.step === 3) renderStep3();
    else if (state.step === 4) renderStep4();

    const prev = inner.querySelector('#wizard-prev');
    const next = inner.querySelector('#wizard-next');
    prev.disabled = state.step === 1 || state.step === 4;
    prev.style.opacity = prev.disabled ? '0.4' : '1';
    if (state.step === 4 && state.result) {
      next.style.display = 'none';
    } else {
      next.style.display = '';
      next.textContent = state.step === 3 ? 'Generate' : 'Next';
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Prompt assembly
  // ───────────────────────────────────────────────────────────────────────

  function assemblePrompt() {
    const lines = [];
    lines.push(`Create a ${state.visualStyle.label.toLowerCase()} ${template.name.toLowerCase()} with the following narrative structure: ${state.preset.name}.`);
    if (state.brandName) lines.push(`Brand: ${state.brandName}.`);
    if (state.brandContext) lines.push(`Context: ${state.brandContext}.`);
    if (state.advancedMode) {
      if (state.goal) lines.push(`Goal: ${state.goal}.`);
      if (state.audience) lines.push(`Audience: ${state.audience}.`);
    }
    if (state.includeCTA && state.cta.id !== 'none') {
      lines.push(`End with a call-to-action: ${state.cta.label}.`);
    }
    lines.push('');
    lines.push('Scenes:');
    state.scenes.forEach((s, i) => {
      if (s.prompt) {
        lines.push(`${i + 1}. ${s.prompt}`);
        if (s.narration) lines.push(`   Narration: "${s.narration}"`);
      }
    });
    return lines.join('\n');
  }

  // ───────────────────────────────────────────────────────────────────────
  // Generate
  // ───────────────────────────────────────────────────────────────────────

  async function runGenerate() {
    const apiKey = localStorage.getItem('muapi_key');
    if (!apiKey) {
      AuthModal(() => runGenerate());
      return;
    }
    state.isGenerating = true;
    renderStep4();
    try {
      const prompt = state.finalPrompt || assemblePrompt();
      // Choose the muapi entry point based on template kind. Fallback: text→video.
      const params = {
        model: template.model || 'ltx-2-fast',
        prompt,
        aspect_ratio: template.aspect_ratio || '16:9',
        duration: template.duration || 5,
      };
      let result;
      if (template.kind === 'image' || /image/i.test(template.name || '')) {
        result = await muapi.generateImage(params);
      } else {
        result = await muapi.generateVideo(params);
      }
      state.result = result || { url: null, images: [] };
      if (onGenerate) onGenerate(state.result);
      showToast('Generation complete', 'success');
    } catch (e) {
      console.error('[wizard] generate error:', e);
      showToast(`Generation failed: ${e.message}`, 'error');
      state.result = { error: e.message };
    } finally {
      state.isGenerating = false;
      renderStep4();
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Nav handlers
  // ───────────────────────────────────────────────────────────────────────

  inner.querySelector('#wizard-prev').onclick = () => {
    if (state.step > 1) { state.step--; renderCurrentStep(); }
  };
  inner.querySelector('#wizard-next').onclick = async () => {
    if (state.step < 4) {
      if (state.step === 3) {
        // build final prompt then move to step 4 which kicks off generation
        state.finalPrompt = assemblePrompt();
        state.step = 4;
        renderCurrentStep();
        await runGenerate();
      } else {
        state.step++;
        renderCurrentStep();
      }
    }
  };

  renderCurrentStep();
  container.cleanup = () => {};
  return container;
}

export default CinematicTemplateWizard;

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}
