/**
 * AIChatPanel — CineGen-style LLM chat for the Timeline Editor.
 *
 * Runs on the OpenAI Responses API with the user's own OpenAI key
 * (/api/timeline-llm, strict JSON output — see src/lib/editor/ai/timelineLlm.js).
 *
 * Modes (CineGen): Ask (project Q&A), Search (quotes and moments with
 * clickable timestamps), Cut (selects → applied as a new timeline tab),
 * Timeline (pacing / edit suggestions, handed to the AI Agent to apply).
 * Also: @ mentions, skills, token usage, GFM tables.
 *
 * callbacks: {
 *   getContext() → string            project context for the model
 *   seekTo(sec)                      jump the playhead
 *   applyCuts(cuts) → string         build a new tab from a cut list
 *   sendToAgent(text)                hand an edit to the AI Agent
 *   toggleVoice(handlers) → boolean  start/stop the Voice Director (true = now listening)
 *   detectScenes, splitClipAtPlayhead, … (executeCommand compatibility)
 * }
 */
import { runLlm, CHAT_MODES, findTimestamps, parseMentions } from '../../lib/editor/ai/timelineLlm.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default class AIChatPanel {
  constructor(container, state, callbacks = {}, { llm = runLlm } = {}) {
    this.container = container;
    this.state = state;
    this.callbacks = callbacks;
    this.llm = llm;
    this.messages = [];
    this.isProcessing = false;
    this.mode = 'ask';
    this.skills = this._loadSkills();
    this.activeSkill = null;
    this.tokenStats = { input: 0, output: 0 };
    this._render();
  }

  _loadSkills() {
    return [
      { id: 'shot-list', name: 'Shot List', icon: '🎬', hint: 'Answer as a shot list.' },
      { id: 'rough-cut', name: 'Rough Cut', icon: '✂️', hint: 'Build a tight rough cut.' },
      { id: 'remove-dead-space', name: 'Remove Dead Space', icon: '⏱️', hint: 'Find pauses and dead air to cut.' },
      { id: 'selects-highlights', name: 'Selects & Highlights', icon: '⭐', hint: 'Pick the strongest moments.' },
      { id: 'b-roll-planner', name: 'B-Roll Planner', icon: '🎥', hint: 'Suggest where B-roll should go and what it shows.' },
      { id: 'prompt-writer', name: 'Prompt Writer', icon: '✍️', hint: 'Write image/video generation prompts.' },
      { id: 'editorial-brief', name: 'Editorial Brief', icon: '📋', hint: 'Summarize as an editorial brief.' },
      { id: 'delivery-prep', name: 'Delivery Prep', icon: '📦', hint: 'Check readiness for export and delivery.' },
    ];
  }

  _render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="ai-chat-panel">
        <div class="ai-chat-header"><h3>AI Assistant</h3>
          <div class="ai-chat-modes" role="tablist" aria-label="Chat mode">
            ${CHAT_MODES.map(([id, label, hint]) => `<button type="button" role="tab" class="mini-btn ${id === this.mode ? 'active' : ''}" data-mode="${id}" aria-selected="${id === this.mode}" title="${esc(hint)}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="ai-chat-messages" id="aiChatMessages" aria-live="polite"></div>
        <div class="ai-chat-skills" id="aiChatSkills"></div>
        <div class="ai-chat-input-row">
          <input class="ai-chat-input" id="aiChatInput" placeholder="Ask about your footage, @mention a clip…" aria-label="Message AI assistant" />
          ${this.callbacks.toggleVoice ? '<button class="ai-chat-voice" id="aiChatVoice" aria-label="Talk to the editor" aria-pressed="false" title="Voice Director: talk to the editor (OpenAI, your key)">🎙</button>' : ''}
          <button class="ai-chat-send" id="aiChatSend" aria-label="Send">↑</button>
        </div>
        <div class="ai-chat-voice-status addon-field__hint" id="aiChatVoiceStatus" role="status"></div>
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
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendMessage(); }
      if (e.key === ' ' && e.shiftKey) { e.preventDefault(); this._toggleSkillPicker(); }
    });
    send?.addEventListener('click', () => this._sendMessage());
    this.container.querySelector('#aiChatVoice')?.addEventListener('click', () => this._toggleVoice());
    this.container.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode)));
  }

  /** Voice Director on/off. The page owns the connection; we show its status and what was said. */
  async _toggleVoice() {
    const btn = this.container?.querySelector('#aiChatVoice');
    const status = this.container?.querySelector('#aiChatVoiceStatus');
    const setStatus = (t) => { if (status) status.textContent = t || ''; };
    try {
      const on = await this.callbacks.toggleVoice({
        onStatus: setStatus,
        onHeard: (t) => this._addMessage('user', `🎙 ${t}`),
        onSaid: (t) => this._addMessage('ai', t),
        onError: (e) => this._addMessage('ai', `⚠️ ${e.message}`),
      });
      btn?.setAttribute('aria-pressed', String(!!on));
      btn?.classList.toggle('active', !!on);
      if (!on) setStatus('');
    } catch (err) {
      btn?.setAttribute('aria-pressed', 'false');
      btn?.classList.remove('active');
      setStatus('');
      this._addMessage('ai', `⚠️ ${err.message}`);
    }
  }

  setMode(mode) {
    if (!CHAT_MODES.some(([id]) => id === mode)) return;
    this.mode = mode;
    this.container?.querySelectorAll('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
  }

  _renderSkills() {
    const container = this.container?.querySelector('#aiChatSkills');
    if (!container) return;
    container.innerHTML = this.skills.map((s) => `<button class="skill-chip ${this.activeSkill?.id === s.id ? 'active' : ''}" data-skill="${s.id}" title="${esc(s.name)}">${s.icon}</button>`).join('');
    container.querySelectorAll('.skill-chip').forEach((btn) => btn.addEventListener('click', () => this._toggleSkill(btn.dataset.skill)));
  }

  _toggleSkill(skillId) {
    const skill = this.skills.find((s) => s.id === skillId);
    if (!skill) return;
    this.activeSkill = this.activeSkill?.id === skillId ? null : skill;
    this._renderSkills();
  }

  _toggleSkillPicker() {
    this.container?.querySelector('#aiChatSkills')?.classList.toggle('expanded');
  }

  async _sendMessage() {
    const input = this.container?.querySelector('#aiChatInput');
    if (!input || !input.value.trim() || this.isProcessing) return;
    const text = input.value.trim();
    input.value = '';
    this._addMessage('user', text);
    this.isProcessing = true;
    this._showTyping();
    try {
      const response = await this._processMessage(text, parseMentions(text));
      this._removeTyping();
      this._addMessage('ai', response.text, response.citations, response);
      this.tokenStats.input += response.tokensIn || 0;
      this.tokenStats.output += response.tokensOut || 0;
      this._updateStats();
    } catch (err) {
      this._removeTyping();
      this._addMessage('ai', `⚠️ ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  _parseMentions(text) {
    return parseMentions(text);
  }

  async _processMessage(text, mentions = []) {
    const context = this._buildContext(mentions);
    const message = this.activeSkill ? `${text}\n(Skill: ${this.activeSkill.name} — ${this.activeSkill.hint})` : text;
    const history = this.messages.slice(-13, -1).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', text: m.text }));
    const { data, usage } = await this.llm('chat', { mode: this.mode, message, history, context });
    const citations = [...(data.citations || [])];
    findTimestamps(data.answer).forEach((t) => { if (!citations.some((c) => Math.abs(c.time - t.time) < 0.05)) citations.push(t); });
    return {
      text: data.answer || '',
      citations,
      cuts: data.cuts || [],
      edits: data.edits || [],
      tokensIn: usage?.input_tokens || 0,
      tokensOut: usage?.output_tokens || 0,
    };
  }

  _buildContext(mentions = []) {
    let context = typeof this.callbacks.getContext === 'function' ? this.callbacks.getContext() : '';
    if (!context) {
      const clipCount = (this.state?.tracks || []).flatMap((t) => t.items || t.clips || []).length;
      context = `Working with ${clipCount} clips across ${this.state?.tracks?.length || 0} tracks.`;
    }
    if (mentions.length) context += `\nThe user mentions: ${mentions.map((m) => `@${m}`).join(', ')} (match these to clip names or ids above).`;
    return context;
  }

  _addMessage(role, text, citations = [], extra = {}) {
    const container = this.container?.querySelector('#aiChatMessages');
    if (!container) return;
    this.messages.push({ role, text, citations, timestamp: Date.now() });
    const el = document.createElement('div');
    el.className = `chat-bubble ${role}`;
    el.innerHTML = this._renderMarkdown(text);

    if (citations.length) {
      const citeEl = document.createElement('div');
      citeEl.className = 'chat-citations';
      citations.slice(0, 20).forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'citation-btn';
        btn.textContent = `⏱ ${c.label} (${this._formatTime(c.time)})`;
        btn.addEventListener('click', () => this.callbacks.seekTo?.(c.time));
        citeEl.appendChild(btn);
      });
      el.appendChild(citeEl);
    }

    if (extra.cuts?.length) {
      const box = document.createElement('div');
      box.className = 'chat-cuts';
      box.innerHTML = `<table class="chat-table"><thead><tr><th>#</th><th>Clip</th><th>In</th><th>Out</th><th>Note</th></tr></thead><tbody>${
        extra.cuts.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.clip_id)}</td><td>${this._formatTime(c.in)}</td><td>${this._formatTime(c.out)}</td><td>${esc(c.note)}</td></tr>`).join('')
      }</tbody></table>`;
      const apply = document.createElement('button');
      apply.className = 'mini-btn cap-primary';
      apply.textContent = 'Apply as new timeline tab';
      apply.addEventListener('click', async () => {
        apply.disabled = true;
        try { this._addMessage('ai', await this.callbacks.applyCuts?.(extra.cuts) || 'Cut applied.'); } catch (err) { this._addMessage('ai', `⚠️ ${err.message}`); apply.disabled = false; }
      });
      box.appendChild(apply);
      el.appendChild(box);
    }

    if (extra.edits?.length) {
      const list = document.createElement('div');
      list.className = 'chat-edits';
      extra.edits.forEach((e) => {
        const row = document.createElement('div');
        row.innerHTML = `<span>${esc(e.action)} · ${esc(e.clip_id)} — ${esc(e.detail)}</span>`;
        if (this.callbacks.sendToAgent) {
          const b = document.createElement('button');
          b.className = 'mini-btn';
          b.textContent = 'Do it with AI Agent';
          b.addEventListener('click', () => this.callbacks.sendToAgent(`${e.action} clip ${e.clip_id}: ${e.detail}`));
          row.appendChild(b);
        }
        list.appendChild(row);
      });
      el.appendChild(list);
    }

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  _renderMarkdown(text) {
    let html = String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/\n\|(.+)\|\n\|[-|:\s]+\|\n((?:\|.+\|\n?)*)/g, (_, header, body) => {
      const headers = header.split('|').filter((h) => h.trim()).map((h) => `<th>${h.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map((row) => `<tr>${row.split('|').filter((c) => c.trim()).map((c) => `<td>${c.trim()}</td>`).join('')}</tr>`).join('');
      return `<table class="chat-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    });
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    return html.replace(/\n/g, '<br>');
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
    this.container?.querySelector('#aiTypingIndicator')?.remove();
  }

  _updateStats() {
    const el = this.container?.querySelector('#aiChatStats');
    if (!el) return;
    el.innerHTML = `<span>Tokens: ${this.tokenStats.input + this.tokenStats.output} (in ${this.tokenStats.input} · out ${this.tokenStats.output})</span><span>OpenAI · your key</span>`;
  }

  _formatTime(seconds) {
    const v = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(v / 60);
    const s = Math.floor(v % 60);
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
      { keys: ['stabilize', 'stabilize footage'], cmd: 'stabilize_video' },
    ];
    for (const entry of map) {
      if (entry.keys.some((key) => lower.includes(key))) return entry.cmd;
    }
    return lower.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown_command';
  }

  async executeCommand({ command, parameters = {}, confidence = 1 }) {
    const actions = this.callbacks || {};
    const table = {
      detect_scenes: ['detectScenes', 'Scene detection completed'],
      split_clip: ['splitClipAtPlayhead', 'Clip split at playhead'],
      trim_clip: ['trimSelectedClip', 'Clip trimmed'],
      add_transition: ['addTransition', 'Transition added'],
      add_text_overlay: ['addTextOverlay', 'Text overlay added'],
      generate_subtitles: ['generateSubtitles', 'Subtitles generated'],
      remove_filler_words: ['removeFillerWords', 'Filler words removed'],
      add_b_roll: ['addBRoll', 'B-Roll added'],
      speed_ramp: ['speedRamp', 'Speed ramp applied'],
      stabilize_video: ['stabilizeVideo', 'Video stabilized'],
    };
    const entry = table[String(command || '').toLowerCase()];
    const handler = entry && typeof actions[entry[0]] === 'function' ? actions[entry[0]] : null;
    if (!handler) return { success: false, response: `I don't know how to execute "${command}"`, confidence };
    try {
      await handler(parameters);
      return { success: true, response: entry[1], confidence };
    } catch (e) {
      return { success: false, response: `Command failed: ${e.message}`, confidence };
    }
  }

  render() {
    return this.container;
  }
}

export { AIChatPanel };
