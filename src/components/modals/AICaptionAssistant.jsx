import { BaseModal } from './BaseModal.jsx';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { generateCaption, generateHashtags, generateABVariations } from '../lib/aiCaptionService.js';

/**
 * AICaptionAssistant - AI-powered caption generation assistant
 * Uses OpenAI Responses API (GPT-5.6 Luna/Terra/Sol) to generate:
 * - Platform-specific captions
 * - Hashtag suggestions
 * - A/B test variations
 */
export class AICaptionAssistant extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'AI Caption Assistant',
      size: 'medium',
      showFooter: false,
      ...options,
    });

    this.compact = options.compact || false;
    this.platform = options.platform || 'instagram';
    this.tone = options.tone || 'engaging';
    this.model = options.model || 'gpt-5.6-luna';
    this.isGenerating = false;
    this.onGenerate = options.onGenerate || (() => {});
    this._element = null;
  }

  getElement() {
    if (this._element) return this._element;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-4';

    const platformRow = document.createElement('div');
    platformRow.className = 'flex flex-col gap-1.5';
    const platformLabel = document.createElement('label');
    platformLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    platformLabel.textContent = 'Platform';
    platformRow.appendChild(platformLabel);

    const platformSelect = document.createElement('select');
    platformSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50';
    ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'].forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p.charAt(0).toUpperCase() + p.slice(1);
      if (p === this.platform) opt.selected = true;
      platformSelect.appendChild(opt);
    });
    platformSelect.onchange = () => { this.platform = platformSelect.value; };
    platformRow.appendChild(platformSelect);
    wrapper.appendChild(platformRow);

    const topicRow = document.createElement('div');
    topicRow.className = 'flex flex-col gap-1.5';
    const topicLabel = document.createElement('label');
    topicLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    topicLabel.textContent = 'Topic / Keywords';
    topicRow.appendChild(topicLabel);

    const topicInput = document.createElement('input');
    topicInput.type = 'text';
    topicInput.placeholder = 'e.g. product launch, tutorial, behind the scenes';
    topicInput.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
    topicRow.appendChild(topicInput);
    wrapper.appendChild(topicRow);

    const toneRow = document.createElement('div');
    toneRow.className = 'flex flex-col gap-1.5';
    const toneLabel = document.createElement('label');
    toneLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    toneLabel.textContent = 'Tone';
    toneRow.appendChild(toneLabel);

    const toneSelect = document.createElement('select');
    toneSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50';
    ['engaging', 'professional', 'casual', 'humorous', 'educational', 'inspirational'].forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === this.tone) opt.selected = true;
      toneSelect.appendChild(opt);
    });
    toneSelect.onchange = () => { this.tone = toneSelect.value; };
    toneRow.appendChild(toneSelect);
    wrapper.appendChild(toneRow);

    // Model selector with explanations
    const modelRow = document.createElement('div');
    modelRow.className = 'flex flex-col gap-1.5';
    const modelLabel = document.createElement('label');
    modelLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    modelLabel.textContent = 'AI Model';
    modelRow.appendChild(modelLabel);

    const modelSelect = document.createElement('select');
    modelSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50';
    const models = [
      { id: 'gpt-5.6-luna', name: '🌙 Luna — Fast & Cheap', desc: 'Best for: captions, hashtags, bulk content. $0.20/MTok input.' },
      { id: 'gpt-5.6-terra', name: '🌍 Terra — Balanced', desc: 'Best for: content ideas, A/B tests, calendars. $2/MTok input.' },
      { id: 'gpt-5.6-sol', name: '☀️ Sol — Most Powerful', desc: 'Best for: strategy, repurposing, analysis. $4/MTok input.' },
    ];
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id === 'gpt-5.6-luna') opt.selected = true;
      modelSelect.appendChild(opt);
    });
    modelSelect.onchange = () => { this.model = modelSelect.value; };
    modelRow.appendChild(modelSelect);

    // Model description tooltip
    const modelDesc = document.createElement('p');
    modelDesc.className = 'text-[10px] text-white/40 mt-1';
    modelDesc.textContent = models[0].desc;
    modelSelect.onchange = () => {
      this.model = modelSelect.value;
      const selected = models.find(m => m.id === modelSelect.value);
      if (selected) modelDesc.textContent = selected.desc;
    };
    modelRow.appendChild(modelDesc);
    wrapper.appendChild(modelRow);

    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.className = 'w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2';
    generateBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/></svg> Generate Caption';
    wrapper.appendChild(generateBtn);

    const resultArea = document.createElement('div');
    resultArea.className = 'hidden bg-white/[0.03] border border-white/[0.06] rounded-xl p-3';
    const resultText = document.createElement('p');
    resultText.className = 'text-sm text-white whitespace-pre-wrap';
    resultArea.appendChild(resultText);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'mt-2 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors';
    copyBtn.textContent = 'Copy to clipboard';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(resultText.textContent).catch(() => {});
    };
    resultArea.appendChild(copyBtn);
    wrapper.appendChild(resultArea);

    const errorArea = document.createElement('div');
    errorArea.className = 'hidden bg-red-500/10 border border-red-500/20 rounded-xl p-3';
    const errorText = document.createElement('p');
    errorText.className = 'text-xs text-red-400';
    errorArea.appendChild(errorText);
    wrapper.appendChild(errorArea);

    generateBtn.onclick = async () => {
      const topic = topicInput.value.trim();
      if (!topic) {
        topicInput.focus();
        return;
      }

      this.isGenerating = true;
      generateBtn.disabled = true;
      generateBtn.innerHTML = '<svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-opacity="0.3"/><path d="M21 12a9 9 0 00-9-9"/></svg> Generating...';
      errorArea.classList.add('hidden');
      resultArea.classList.add('hidden');

      try {
        // Generate caption using AI service with selected model
        const result = await generateCaption({
          platform: this.platform,
          tone: this.tone,
          content: topic,
          model: this.model,
        });

        // Generate hashtags with selected model
        const hashtagResult = await generateHashtags({
          platform: this.platform,
          caption: result.caption,
          count: 10,
          model: this.model,
        });

        const hashtagsStr = hashtagResult.hashtags.join(' ');
        resultText.textContent = `${result.caption}\n\n${hashtagsStr}`;
        resultArea.classList.remove('hidden');
        this.onGenerate(result.caption);
      } catch (err) {
        console.error('[AICaptionAssistant] generation failed:', err);
        errorText.textContent = err.message || 'Failed to generate caption';
        errorArea.classList.remove('hidden');
      } finally {
        this.isGenerating = false;
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/></svg> Generate Caption';
      }
    };

    this._element = wrapper;
    return wrapper;
  }

  renderBody() {
    const el = this.getElement();
    return el.outerHTML;
  }
}
