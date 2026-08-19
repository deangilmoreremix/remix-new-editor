import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { openaiService } from '../lib/openaiService.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openModelPicker } from '../lib/modelPickerIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

const SHOT_TYPES = ['Wide Shot', 'Medium Shot', 'Close-Up', 'Extreme Close-Up', 'POV', 'Overhead', 'Low Angle'];
const LAYOUTS = ['Horizontal', 'Grid', 'Story'];

export function StoryboardStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative storyboard-studio';
  mountStudioChrome(container, { currentRoute: 'storyboard' });
  container.setAttribute('data-app', 'storyboard');

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  const storyBanner = createHeroSection('storyboard', 'h-32 md:h-44 mb-4');
  if (storyBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Storyboard Studio</h1><p class="text-white/60 text-xs">Plan your scenes with AI-generated storyboard frames</p>';
    storyBanner.appendChild(bannerText);
    topBar.appendChild(storyBanner);
  } else {
    topBar.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Storyboard Studio</h1><p class="text-secondary text-xs mb-4">Plan your scenes with AI-generated storyboard frames</p>';
  }
  const inlineInstructions = createInlineInstructions('storyboard');
  inlineInstructions.classList.add('px-4', 'md:px-8', 'mt-2');
  topBar.appendChild(inlineInstructions);

  container.appendChild(topBar);

  const frames = [
    { prompt: '', narration: '', shot: 'Wide Shot', imageUrl: null },
    { prompt: '', narration: '', shot: 'Medium Shot', imageUrl: null },
    { prompt: '', narration: '', shot: 'Close-Up', imageUrl: null },
  ];

  const controlBar = document.createElement('div');
  controlBar.className = 'px-4 md:px-8 mb-4 flex items-center gap-3 flex-wrap';

  // Layout selector
  const layoutLabel = document.createElement('span');
  layoutLabel.className = 'text-xs font-bold text-secondary';
  layoutLabel.textContent = 'Layout:';
  controlBar.appendChild(layoutLabel);

  const layoutSelect = document.createElement('select');
  layoutSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  LAYOUTS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.toLowerCase();
    opt.textContent = l;
    opt.style.background = '#111';
    layoutSelect.appendChild(opt);
  });
  layoutSelect.onchange = () => { renderFrames(); };
  controlBar.appendChild(layoutSelect);

  const addFrameBtn = document.createElement('button');
  addFrameBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  addFrameBtn.textContent = '+ Add Frame';
  addFrameBtn.onclick = () => {
    frames.push({ prompt: '', narration: '', shot: 'Wide Shot', imageUrl: null });
    renderFrames();
  };
  controlBar.appendChild(addFrameBtn);

  const genAllBtn = document.createElement('button');
  genAllBtn.className = 'px-4 py-2 bg-primary text-black rounded-xl text-xs font-bold hover:shadow-glow transition-all';
  genAllBtn.textContent = 'Generate All Frames';
  controlBar.appendChild(genAllBtn);

  // Premium GTM Boost entry point — opens the cinematic prompt enhancer.
  // Produces a conversion-optimized base concept that is propagated to every
  // frame (prepended to each frame's own prompt at generation time).
  let enhancedConcept = '';
  const gtmBtn = document.createElement('button');
  gtmBtn.type = 'button';
  gtmBtn.textContent = '🎯 GTM Boost';
  gtmBtn.title = 'Enhance your storyboard with GTM conversion frameworks';
  gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
  gtmBtn.className = 'gtm-boost-btn shrink-0';
  gtmBtn.addEventListener('click', () => {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('storyboard', (prompt) => {
        enhancedConcept = prompt;
        gtmBtn.classList.add('active');
        // Re-render so any visible "boosted" indicator stays in sync.
        renderFrames();
      });
    }).catch((err) => console.error('[StoryboardStudio] GTM Boost failed:', err));
  });
  controlBar.appendChild(gtmBtn);

  const personalizeTrigger = mountPersonalizeTrigger({ controlsContainer: controlBar, appId: 'storyboard', getTextarea: () => null });
  // Live reference to the active personalization profile so generateFrame can
  // resolve {{tokens}} at generation time without mutating the textarea.
  const activeProfileRef = { value: null };
  const syncProfile = () => { activeProfileRef.value = personalizeTrigger?.getActiveProfile?.() || null; };
  syncProfile();
  window.addEventListener('remix:contact-changed', syncProfile);

  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'px-4 py-2 bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition-all ml-auto';
  exportBtn.innerHTML = 'Export PDF';
  exportBtn.onclick = () => {
    // Simple export - download as JSON for now
    const data = JSON.stringify(frames, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'storyboard.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  controlBar.appendChild(exportBtn);

  // Model Picker button
  const modelPickerBtn = document.createElement('button');
  modelPickerBtn.type = 'button';
  modelPickerBtn.textContent = 'AI Pick';
  modelPickerBtn.title = 'Open intelligent model picker';
  modelPickerBtn.setAttribute('aria-label', 'Open model picker');
  modelPickerBtn.className = 'text-[11px] font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 rounded-lg hover:bg-cyan-400/20 transition-colors ml-2 whitespace-nowrap';
  modelPickerBtn.addEventListener('click', () => {
    openModelPicker({}).catch((err) => console.error('[ModelPicker] open failed:', err));
  });
  controlBar.appendChild(modelPickerBtn);

  container.appendChild(controlBar);

  const framesArea = document.createElement('div');
  framesArea.className = 'px-4 md:px-8 pb-8 flex gap-4 overflow-x-auto no-scrollbar';
  container.appendChild(framesArea);

  function renderFrames() {
    framesArea.innerHTML = '';
    frames.forEach((frame, idx) => {
      const card = document.createElement('div');
      card.className = 'shrink-0 w-72 bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3';

      const frameNum = document.createElement('div');
      frameNum.className = 'flex items-center justify-between';
      frameNum.innerHTML = `
        <span class="text-xs font-bold text-primary">Frame ${idx + 1}</span>
        <button class="text-muted hover:text-red-400 transition-colors text-xs remove-frame">&times;</button>
      `;
      card.appendChild(frameNum);

      const imageArea = document.createElement('div');
      imageArea.className = 'w-full aspect-video bg-white/[0.02] rounded-lg border border-white/5 flex items-center justify-center overflow-hidden';
      if (frame.imageUrl) {
        imageArea.innerHTML = `<img src="${frame.imageUrl}" class="w-full h-full object-cover">`;
      } else {
        imageArea.innerHTML = '<span class="text-muted text-xs">No image</span>';
      }
      card.appendChild(imageArea);

      const shotSelect = document.createElement('select');
      shotSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
      SHOT_TYPES.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        opt.style.background = '#111';
        if (s === frame.shot) opt.selected = true;
        shotSelect.appendChild(opt);
      });
      shotSelect.onchange = () => { frame.shot = shotSelect.value; };
      card.appendChild(shotSelect);

      const promptInput = document.createElement('textarea');
      promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 resize-none';
      promptInput.rows = 2;
      promptInput.placeholder = 'Describe this scene...';
      promptInput.value = frame.prompt;
      promptInput.oninput = () => { frame.prompt = promptInput.value; };
      card.appendChild(promptInput);

      // Per-frame GTM Boost — enhances this single frame's prompt.
      const frameEnhanceBtn = document.createElement('button');
      frameEnhanceBtn.type = 'button';
      frameEnhanceBtn.className = 'self-start text-xs font-bold text-primary hover:text-white transition-colors frame-enhance-btn';
      frameEnhanceBtn.textContent = '🎯 Enhance';
      frameEnhanceBtn.title = 'Enhance this frame with GTM conversion frameworks';
      frameEnhanceBtn.addEventListener('click', () => {
        import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
          openGTMPromptModal('storyboard', (prompt) => {
            frame.enhancedPrompt = prompt;
            frameEnhanceBtn.textContent = '🎯 Enhanced';
            frameEnhanceBtn.classList.add('active');
          });
        }).catch((err) => console.error('[StoryboardStudio] Frame GTM Boost failed:', err));
      });
      const enhanceRow = document.createElement('div');
      enhanceRow.className = 'flex items-center justify-between -mt-1';
      const enhanceHint = document.createElement('span');
      enhanceHint.className = 'text-[10px] text-muted';
      enhanceHint.textContent = 'GTM-conversion boost';
      enhanceRow.appendChild(enhanceHint);
      enhanceRow.appendChild(frameEnhanceBtn);
      card.appendChild(enhanceRow);

      // Narration input
      const narrationInput = document.createElement('input');
      narrationInput.type = 'text';
      narrationInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
      narrationInput.placeholder = 'Narration text (optional)...';
      narrationInput.value = frame.narration || '';
      narrationInput.oninput = () => { frame.narration = narrationInput.value; };
      card.appendChild(narrationInput);

      const genFrameBtn = document.createElement('button');
      genFrameBtn.className = 'w-full bg-white/10 text-white py-2 rounded-lg text-xs font-bold hover:bg-white/20 transition-all';
      genFrameBtn.textContent = 'Generate Frame';
      genFrameBtn.onclick = () => generateFrame(idx, genFrameBtn, imageArea);
      card.appendChild(genFrameBtn);

      card.querySelector('.remove-frame').onclick = () => {
        if (frames.length > 1) { frames.splice(idx, 1); renderFrames(); }
      };

      framesArea.appendChild(card);
    });
  }


    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'gtm-boost-btn shrink-0';
    promptGalleryBtn.addEventListener('click', () => {
      openPromptGallery({
        appTheme: 'storyboard-studio',
        onSelect: (prompt) => {
          // Default: try to find a textarea in the studio
          const ta = document.querySelector('textarea') || document.querySelector('[data-prompt]');
          if (ta) {
            ta.value = prompt;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.focus();
          }
        }
      }).catch((err) => console.error('[PromptGallery] open failed:', err));
    });

    // Recipe Engine button
    const recipeBtn = document.createElement('button');
    recipeBtn.type = 'button';
    recipeBtn.textContent = '📋 Recipes';
    recipeBtn.title = 'Browse AI recipes';
    recipeBtn.setAttribute('aria-label', 'Open recipe engine');
    recipeBtn.className = 'gtm-boost-btn shrink-0';
    recipeBtn.addEventListener('click', () => {
      openRecipeModal({
        onRunRecipe: (url) => {
        }
      }).catch((err) => console.error('[Recipe] open failed:', err));
    });


    // Monetization Hub button
    const monetizationBtn = document.createElement('button');
    monetizationBtn.type = 'button';
    monetizationBtn.textContent = '💼 Monetize';
    monetizationBtn.title = 'Open monetization hub';
    monetizationBtn.setAttribute('aria-label', 'Open monetization hub');
    monetizationBtn.className = 'gtm-boost-btn shrink-0';
    monetizationBtn.addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
  controlBar.appendChild(recipeBtn);
  controlBar.appendChild(monetizationBtn);

  async function generateFrame(idx, btn, imageArea) {
    const frame = frames[idx];
    if (!frame.prompt.trim()) { alert('Enter a scene description'); return; }
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (!hasKey) { AuthModal(() => generateFrame(idx, btn, imageArea)); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span>';

    try {
      // Resolve personalization tokens at generation time only (tokens stay
      // visible in the textarea until now).
      let rawPrompt = frame.prompt;
      if (frame.enhancedPrompt) {
        // Per-frame GTM Boost output takes precedence for this frame.
        rawPrompt = `${frame.enhancedPrompt} — ${frame.shot} composition`;
      } else if (enhancedConcept) {
        // Global GTM Boost concept propagated to every frame.
        rawPrompt = `${enhancedConcept} Scene: ${frame.prompt} (${frame.shot})`;
      }
      const profile = activeProfileRef.value;
      const resolvedPrompt = profile ? replaceTokensInPrompt(rawPrompt, profile) : rawPrompt;

      const prompt = `${frame.shot} cinematic storyboard frame: ${resolvedPrompt}, professional cinematography, 4K quality`;
      const url = await generateFrameImage(prompt);
      if (url) {
        frame.imageUrl = url;
        imageArea.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Frame';
    }
  }

  /**
   * Generate a single storyboard frame image. Prefers the user's OpenAI key
   * (direct to the OpenAI Image API) and falls back to MuAPI when only a MuAPI
   * key is configured.
   * @param {string} prompt
   * @returns {Promise<string|null>} image URL/data-URL or null
   */
   async function generateFrameImage(prompt) {
     if (apiKeyManager.hasOpenAIKey()) {
       try {
         const { images } = await openaiService.generateImageResponses({
           input: prompt,
           size: '16:9',
           quality: 'auto',
           outputFormat: 'png',
         });
         const img = images?.[0];
         if (!img) return null;
         return img.base64 ? `data:image/png;base64,${img.base64}` : img.url || null;
       } catch (err) {
         // Surface OpenAI-specific failures clearly; MuAPI fallback below.
         if (!apiKeyManager.hasMuapiKey()) throw err;
         console.warn('[StoryboardStudio] OpenAI Responses generation failed, falling back to MuAPI:', err.message);
       }
     }
     const result = await muapi.generateImage({ model: 'nano-banana', prompt, aspect_ratio: '16:9' });
     return result?.url || null;
   }

  genAllBtn.onclick = async () => {
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (!hasKey) { AuthModal(() => genAllBtn.click()); return; }

    genAllBtn.disabled = true;
    genAllBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    for (let i = 0; i < frames.length; i++) {
      if (frames[i].prompt.trim()) {
        const card = framesArea.children[i];
        const btn = card.querySelector('button:last-child');
        const imageArea = card.querySelector('.aspect-video');
        await generateFrame(i, btn, imageArea);
      }
    }

    genAllBtn.disabled = false;
    genAllBtn.textContent = 'Generate All Frames';
  };

  renderFrames();
  return container;
}
