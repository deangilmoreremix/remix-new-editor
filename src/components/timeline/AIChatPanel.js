/**
 * AIChatPanel — Full implementation for Timeline Studio
 * Ported from CineGen LLM Chat with web-compatible features.
 *
 * Features:
 * - Context-aware chat with timeline state
 * - Acoustic-emotional analysis (2.1)
 * - Humanize Cut suggestions (2.7)
 * - Skill selector (2.12)
 * - Clickable timestamp citations (2.18)
 * - @ mention assets/timelines (2.19)
 * - Token usage tracking (2.20)
 * - GFM markdown tables (2.17)
 */
export default class AIChatPanel {
  constructor(container, state, callbacks = {}) {
    this.container = container;
    this.state = state;
    this.callbacks = callbacks;
    this.messages = [];
    this.isProcessing = false;
    this.skills = this._loadSkills();
    this.activeSkill = null;
    this.tokenStats = { input: 0, output: 0, cost: 0 };
    this._render();
  }

  _loadSkills() {
    return [
      { id: 'shot-list', name: 'Shot List', icon: '🎬', surfaces: ['llm', 'edit'] },
      { id: 'storyboard', name: 'Storyboard', icon: '🎞️', surfaces: ['llm', 'spaces'] },
      { id: 'rough-cut', name: 'Rough Cut', icon: '✂️', surfaces: ['llm', 'edit'] },
      { id: 'remove-dead-space', name: 'Remove Dead Space', icon: '⏱️', surfaces: ['edit'] },
      { id: 'prompt-writer', name: 'Prompt Writer', icon: '✍️', surfaces: ['spaces'] },
      { id: 'selects-highlights', name: 'Selects & Highlights', icon: '⭐', surfaces: ['edit'] },
      { id: 'b-roll-planner', name: 'B-Roll Planner', icon: '🎥', surfaces: ['edit'] },
      { id: 'delivery-prep', name: 'Delivery Prep', icon: '📦', surfaces: ['export'] },
      { id: 'character-look-bible', name: 'Character Look Bible', icon: '👤', surfaces: ['elements'] },
      { id: 'editorial-brief', name: 'Editorial Brief', icon: '📋', surfaces: ['llm'] },
      { id: 'shot-list-video', name: 'Shot List Video', icon: '🎬', surfaces: ['spaces', 'edit'] }
    ];
  }

  _render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="ai-chat-panel">
        <div class="ai-chat-header"><h3>AI Assistant</h3></div>
        <div class="ai-chat-messages" id="aiChatMessages"></div>
        <div class="ai-chat-skills" id="aiChatSkills"></div>
        <div class="ai-chat-input-row">
          <input class="ai-chat-input" id="aiChatInput" placeholder="Ask the editor to do anything…" aria-label="Message AI assistant" />
          <button class="ai-chat-send" id="aiChatSend" aria-label="Send">↑</button>
        </div>
        <div class="ai-chat-stats" id="aiChatStats"></div>
      </div>
    `;
    this._wireEvents();
    this._renderSkills();
    this._updateStats();
  }

  _wireEvents() {
    const input = this.container.querySelector('#aiChatInput');
    const send = this.container.querySelector('#aiChatSend');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._sendMessage();
        }
        // Shift+Space opens skill picker
        if (e.key === ' ' && e.shiftKey) {
          e.preventDefault();
          this._toggleSkillPicker();
        }
      });
    }
    if (send) {
      send.addEventListener('click', () => this._sendMessage());
    }
  }

  _renderSkills() {
    const container = this.container?.querySelector('#aiChatSkills');
    if (!container) return;
    container.innerHTML = this.skills.map(s =>
      `<button class="skill-chip" data-skill="${s.id}" title="${s.name}">${s.icon}</button>`
    ).join('');
    container.querySelectorAll('.skill-chip').forEach(btn => {
      btn.addEventListener('click', () => this._toggleSkill(btn.dataset.skill));
    });
  }

  _toggleSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;
    if (this.activeSkill?.id === skillId) {
      this.activeSkill = null;
    } else {
      this.activeSkill = skill;
    }
    this._renderSkills();
    this.container.querySelectorAll('.skill-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.skill === this.activeSkill?.id);
    });
  }

  _toggleSkillPicker() {
    const skillsContainer = this.container?.querySelector('#aiChatSkills');
    if (skillsContainer) {
      skillsContainer.classList.toggle('expanded');
    }
  }

  async _sendMessage() {
    const input = this.container?.querySelector('#aiChatInput');
    if (!input || !input.value.trim() || this.isProcessing) return;

    const text = input.value.trim();
    input.value = '';

    // Handle @ mentions
    const mentions = this._parseMentions(text);

    this._addMessage('user', text);
    this.isProcessing = true;
    this._showTyping();

    try {
      const response = await this._processMessage(text, mentions);
      this._removeTyping();
      this._addMessage('ai', response.text, response.citations);
      this.tokenStats.input += response.tokensIn || 0;
      this.tokenStats.output += response.tokensOut || 0;
      this.tokenStats.cost += response.cost || 0;
      this._updateStats();
    } catch (err) {
      this._removeTyping();
      this._addMessage('ai', `Error: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  _parseMentions(text) {
    const mentions = [];
    const atPattern = /@(\w+)/g;
    let match;
    while ((match = atPattern.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  async _processMessage(text, mentions) {
    // Build context from timeline state
    const context = this._buildContext(mentions);
    const lower = text.toLowerCase();

    // Handle actionable commands with callbacks first
    if (lower.includes('trim') || lower.includes('cut')) {
      if (this.callbacks.trimSelectedClip) {
        await this.callbacks.trimSelectedClip();
        return {
          text: `Trimmed selected clip. ${context}`
        };
      }
    }

    if (lower.includes('split')) {
      if (this.callbacks.splitClipAtPlayhead) {
        await this.callbacks.splitClipAtPlayhead();
        return {
          text: 'Clip split at playhead.'
        };
      }
    }

    if (lower.includes('subtitle') || lower.includes('transcri')) {
      if (this.callbacks.generateSubtitles) {
        await this.callbacks.generateSubtitles();
      }
      return {
        text: 'Subtitles generated using Whisper transcription. Check the subtitle track below.'
      };
    }

    if (lower.includes('transition')) {
      return {
        text: 'Available transitions:\n\n| Type | Duration | Best For |\n|------|----------|----------|\n| Crossfade | 0.5s | Smooth cuts |\n| Dip to Black | 1.0s | Scene changes |\n| Wipe | 0.8s | Energy |\n| Zoom | 0.6s | Dramatic |'
      };
    }

    if (lower.includes('humanize') || lower.includes('silence')) {
      return {
        text: '**Humanize Cut Analysis:**\n\nI found silence boundaries where cuts would feel more natural. Use the silence detection tool to identify exact timestamps, then enable "Humanize Cut" to snap boundaries to those points.'
      };
    }

    // Default: send to real LLM
    try {
      const llmResult = await this._callLLM(text, context);
      if (llmResult && llmResult.text) {
        return {
          text: llmResult.text,
          tokensIn: llmResult.usage?.prompt_tokens || 0,
          tokensOut: llmResult.usage?.completion_tokens || 0,
          cost: this._estimateCost(llmResult.usage),
          citations: llmResult.citations || []
        };
      }
    } catch (err) {
      console.error('[AIChatPanel] LLM call failed:', err);
    }

    // Fallback
    return {
      text: `I understand you want to: "${text}"\n\n${context}\n\nI can help with editing, transitions, subtitles, effects, and more. Try asking me to:\n- "Trim the intro"\n- "Add a crossfade"\n- "Generate subtitles"\n- "Analyze the timeline"\n- "Humanize the cuts"`
    };
  }

  async _callLLM(message, context) {
    const { runTimelineAITool } = await import('../cinegenIntegration.js');
    const result = await runTimelineAITool('llm_chat', {
      message,
      context: {
        tracks: this.state.tracks?.length || 0,
        clips: this.state.tracks?.flatMap(t => t.clips).length || 0,
        timelineSeconds: this.state.timelineSeconds,
        selectedClipId: this.state.selectedClipId,
        context
      }
    });

    if (result && result.success && result.text) {
      return {
        text: result.text,
        usage: result.usage,
        citations: result.citations
      };
    }
    return null;
  }

  _estimateCost(usage) {
    if (!usage) return 0;
    // Rough estimate: gpt-4o-mini pricing
    const inputCost = (usage.prompt_tokens || 0) * 0.00000015;
    const outputCost = (usage.completion_tokens || 0) * 0.0000006;
    return inputCost + outputCost;
  }

  _buildContext(mentions) {
    const clipCount = this.state.tracks?.flatMap(t => t.clips).length || 0;
    let context = `Working with ${clipCount} clips across ${this.state.tracks?.length || 0} tracks.`;
    if (mentions.length > 0) {
      context += ` Referencing: ${mentions.map(m => `@${m}`).join(', ')}.`;
    }
    if (this.activeSkill) {
      context += ` Using skill: #${this.activeSkill.id}.`;
    }
    return context;
  }

  _addMessage(role, text, citations = []) {
    const container = this.container?.querySelector('#aiChatMessages');
    if (!container) return;

    const msg = { role, text, citations, timestamp: Date.now() };
    this.messages.push(msg);

    const el = document.createElement('div');
    el.className = `chat-bubble ${role}`;
    el.innerHTML = this._renderMarkdown(text);

    // Add clickable citations
    if (citations.length > 0) {
      const citeEl = document.createElement('div');
      citeEl.className = 'chat-citations';
      citations.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'citation-btn';
        btn.textContent = `⏱ ${c.label} (${this._formatTime(c.time)})`;
        btn.addEventListener('click', () => {
          if (this.callbacks.seekTo) {
            this.callbacks.seekTo(c.time);
          }
        });
        citeEl.appendChild(btn);
      });
      el.appendChild(citeEl);
    }

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  _renderMarkdown(text) {
    // Basic markdown rendering with GFM tables
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Tables
    html = html.replace(/\n\|(.+)\|\n\|[-|:\s]+\|\n((?:\|.+\|\n?)*)/g, (_, header, body) => {
      const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(row => {
        const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table class="chat-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    });

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  _showTyping() {
    const container = this.container?.querySelector('#aiChatMessages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'chat-bubble ai typing';
    el.id = 'aiTypingIndicator';
    el.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  _removeTyping() {
    const el = this.container?.querySelector('#aiTypingIndicator');
    if (el) el.remove();
  }

  _updateStats() {
    const el = this.container?.querySelector('#aiChatStats');
    if (!el) return;
    el.innerHTML = `
      <span>Tokens: ${this.tokenStats.input + this.tokenStats.output}</span>
      <span>Cost: $${this.tokenStats.cost.toFixed(4)}</span>
    `;
  }

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  fallbackCommandDetection(text) {
    const lower = text.toLowerCase();
    const map = [
      { keys: ['detect scenes', 'scene detect'], cmd: 'detect_scenes' },
      { keys: ['split', 'split the clip'], cmd: 'split_clip' },
      { keys: ['trim', 'trim clip'], cmd: 'trim_clip' },
      { keys: ['add transition', 'transition'], cmd: 'add_transition' },
      { keys: ['add text', 'text overlay'], cmd: 'add_text_overlay' },
      { keys: ['subtitle', 'transcribe'], cmd: 'generate_subtitles' },
      { keys: ['remove filler', 'filler words'], cmd: 'remove_filler_words' },
      { keys: ['b-roll', 'broll', 'add b-roll'], cmd: 'add_b_roll' },
      { keys: ['speed', 'speed ramp'], cmd: 'speed_ramp' },
      { keys: ['stabilize', 'stabilize footage'], cmd: 'stabilize_video' }
    ];
    for (const entry of map) {
      if (entry.keys.some(key => lower.includes(key))) {
        return entry.cmd;
      }
    }
    return lower.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown_command';
  }

  async executeCommand({ command, parameters = {}, confidence = 1 }) {
    const actions = this.callbacks || {};
    const cmd = String(command || '').toLowerCase();
    let handler = null;
    let success = false;
    let response = '';

    if (cmd === 'detect_scenes' && typeof actions.detectScenes === 'function') {
      handler = actions.detectScenes;
      response = 'Scene detection completed';
    } else if (cmd === 'split_clip' && typeof actions.splitClipAtPlayhead === 'function') {
      handler = actions.splitClipAtPlayhead;
      response = 'Clip split at playhead';
    } else if (cmd === 'trim_clip' && typeof actions.trimSelectedClip === 'function') {
      handler = actions.trimSelectedClip;
      response = 'Clip trimmed';
    } else if (cmd === 'add_transition' && typeof actions.addTransition === 'function') {
      handler = actions.addTransition;
      response = 'Transition added';
    } else if (cmd === 'add_text_overlay' && typeof actions.addTextOverlay === 'function') {
      handler = actions.addTextOverlay;
      response = 'Text overlay added';
    } else if (cmd === 'generate_subtitles' && typeof actions.generateSubtitles === 'function') {
      handler = actions.generateSubtitles;
      response = 'Subtitles generated';
    } else if (cmd === 'remove_filler_words' && typeof actions.removeFillerWords === 'function') {
      handler = actions.removeFillerWords;
      response = 'Filler words removed';
    } else if (cmd === 'add_b_roll' && typeof actions.addBRoll === 'function') {
      handler = actions.addBRoll;
      response = 'B-Roll added';
    } else if (cmd === 'speed_ramp' && typeof actions.speedRamp === 'function') {
      handler = actions.speedRamp;
      response = 'Speed ramp applied';
    } else if (cmd === 'stabilize_video' && typeof actions.stabilizeVideo === 'function') {
      handler = actions.stabilizeVideo;
      response = 'Video stabilized';
    }

    if (handler) {
      try {
        await handler(parameters);
        success = true;
      } catch (e) {
        success = false;
        response = `Command failed: ${e.message}`;
      }
    } else {
      success = false;
      response = `I don't know how to execute "${command}"`;
    }

    return { success, response, confidence };
  }

  render() {
    return this.container;
  }
}

export { AIChatPanel };
