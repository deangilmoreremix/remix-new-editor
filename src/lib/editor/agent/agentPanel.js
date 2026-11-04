/**
 * "AI Video" chat panel: the user describes a video or animation, the
 * agent builds it on the timeline. Shows the agent's messages, each tool
 * step, rendered preview frames, Stop, and a provider choice.
 */
import { runAgentTurn, describeToolCall } from './videoAgent.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const AGENT_SUGGESTIONS = [
  'Make a 15-second promo for a coffee shop with stock footage, an animated title and captions',
  'Add an animated intro title that says "Welcome" for the first 3 seconds',
  'Add a lower third with my name and a slow zoom on the first clip',
  'Turn the speech in my video into word-by-word captions',
];

/** Minimal, safe formatting: paragraphs, bullet lists, **bold**. */
function formatText(text) {
  const lines = esc(text).split('\n');
  let html = '';
  let inList = false;
  lines.forEach((line) => {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const body = (bullet ? bullet[1] : line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${body}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (body.trim()) html += `<p>${body}</p>`;
    }
  });
  if (inList) html += '</ul>';
  return html;
}

/**
 * @param {HTMLElement} container
 * @param {object} opts
 *   tools                { definitions, run }
 *   providers            Promise<{ openai, anthropic }> (which are configured)
 *   onTurnStart()        e.g. save an undo snapshot (one undo step per turn)
 *   onTurnEnd()
 *   step                 (tests) override of the server step
 */
export function renderAgentPanel(container, opts = {}) {
  const state = { history: [], items: [], busy: false, controller: null, provider: 'openai', providers: null };
  const urls = [];

  container.innerHTML = `
    <div class="agent-panel">
      <div class="agent-head">
        <label class="agent-provider"><span>Model</span>
          <select data-agent-provider aria-label="AI model">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Claude</option>
          </select></label>
        <button type="button" class="mini-btn" data-agent-new>New chat</button>
      </div>
      <div class="agent-log" data-agent-log role="log" aria-live="polite"></div>
      <div class="agent-suggest" data-agent-suggest>${AGENT_SUGGESTIONS.map((s, i) => `<button type="button" class="fx-chip" data-agent-suggestion="${i}">${esc(s)}</button>`).join('')}</div>
      <form class="agent-form" data-agent-form>
        <textarea data-agent-input rows="3" placeholder="Describe the video or animation you want…" aria-label="Message to the AI Video agent"></textarea>
        <div class="agent-actions">
          <span class="addon-field__hint" data-agent-status></span>
          <button type="button" class="mini-btn" data-agent-stop hidden>Stop</button>
          <button type="submit" class="mini-btn cap-primary" data-agent-send>Send</button>
        </div>
      </form>
    </div>`;
  const $ = (sel) => container.querySelector(sel);
  const log = $('[data-agent-log]');

  const renderItem = (it) => {
    if (it.kind === 'user') return `<div class="agent-msg agent-msg--user">${esc(it.text)}</div>`;
    if (it.kind === 'assistant') return `<div class="agent-msg agent-msg--ai">${formatText(it.text)}</div>`;
    if (it.kind === 'error') return `<div class="agent-msg agent-msg--error" role="alert">${esc(it.text)}</div>`;
    if (it.kind === 'tool') {
      return `<div class="agent-step${it.done ? (it.ok ? ' is-ok' : ' is-err') : ' is-run'}">
        <span class="agent-step__icon" aria-hidden="true">${it.done ? (it.ok ? '✓' : '!') : '…'}</span>
        <span>${esc(it.label)}</span>
        ${it.done && !it.ok ? `<details><summary>details</summary><pre>${esc(String(it.content).slice(0, 600))}</pre></details>` : ''}
        ${it.image ? `<img class="agent-still" src="${esc(it.image)}" alt="Preview frame rendered by the agent"/>` : ''}
      </div>`;
    }
    return '';
  };
  const draw = () => {
    log.innerHTML = state.items.map(renderItem).join('') || '<p class="addon-field__hint">Ask for a video, an animation or an edit. The agent uses stock footage, overlays, captions, effects, keyframes and Remotion animations, and every change can be undone in one step.</p>';
    log.scrollTop = log.scrollHeight;
    $('[data-agent-suggest]').hidden = state.items.length > 0;
    $('[data-agent-stop]').hidden = !state.busy;
    $('[data-agent-send]').disabled = state.busy;
    $('[data-agent-input]').disabled = state.busy;
    $('[data-agent-status]').textContent = state.busy ? 'Working…' : '';
  };

  const send = async (text) => {
    const msg = String(text || '').trim();
    if (!msg || state.busy) return;
    state.busy = true;
    state.controller = new AbortController();
    state.items.push({ kind: 'user', text: msg });
    draw();
    opts.onTurnStart?.();
    const byId = new Map();
    try {
      await runAgentTurn({
        history: state.history,
        text: msg,
        tools: opts.tools,
        provider: state.provider,
        step: opts.step,
        signal: state.controller.signal,
        onEvent: (e) => {
          if (e.type === 'assistant') state.items.push({ kind: 'assistant', text: e.text });
          else if (e.type === 'tool-start') {
            const it = { kind: 'tool', label: describeToolCall(e.name, e.args), done: false };
            byId.set(e.id, it);
            state.items.push(it);
          } else if (e.type === 'tool-done') {
            const it = byId.get(e.id) || { kind: 'tool', label: e.name };
            Object.assign(it, { done: true, ok: e.ok, content: e.content });
            if (e.image) { it.image = URL.createObjectURL(e.image); urls.push(it.image); }
          } else if (e.type === 'limit') state.items.push({ kind: 'error', text: `Paused after ${e.steps} steps — say "continue" to keep going.` });
          draw();
        },
      });
    } catch (err) {
      if (err?.name === 'AbortError') state.items.push({ kind: 'error', text: 'Stopped.' });
      else {
        state.items.push({ kind: 'error', text: err?.message || 'Something went wrong.' });
        // Drop an unanswered user message so the next attempt starts cleanly.
        const last = state.history[state.history.length - 1];
        if (last?.role === 'user') state.history.pop();
      }
    } finally {
      state.busy = false;
      state.controller = null;
      opts.onTurnEnd?.();
      draw();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const input = $('[data-agent-input]');
    const text = input.value;
    input.value = '';
    send(text);
  };
  const onKey = (e) => {
    if (e.target.matches('[data-agent-input]') && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('[data-agent-form]').requestSubmit?.() ?? onSubmit(e);
    }
  };
  const onClick = (e) => {
    const b = e.target.closest('button');
    if (!b || !container.contains(b)) return;
    if (b.dataset.agentStop !== undefined) state.controller?.abort();
    else if (b.dataset.agentNew !== undefined && !state.busy) { state.history = []; state.items = []; draw(); }
    else if (b.dataset.agentSuggestion !== undefined) send(AGENT_SUGGESTIONS[Number(b.dataset.agentSuggestion)]);
  };
  const onChange = (e) => {
    if (e.target.matches('[data-agent-provider]')) {
      state.provider = e.target.value;
      // Provider-specific history can't be replayed on the other model.
      if (state.history.length) { state.history = []; state.items.push({ kind: 'error', text: 'Switched model — starting a new conversation.' }); draw(); }
    }
  };

  container.addEventListener('submit', onSubmit);
  container.addEventListener('keydown', onKey);
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  Promise.resolve(opts.providers).then((p) => {
    if (!p) return;
    state.providers = p;
    const sel = $('[data-agent-provider]');
    [...sel.options].forEach((o) => { if (p[o.value] === false) { o.disabled = true; o.textContent += ' (not set up)'; } });
    if (p.openai === false && p.anthropic) { sel.value = 'anthropic'; state.provider = 'anthropic'; }
  }).catch(() => {});
  draw();

  return {
    send,
    get busy() { return state.busy; },
    destroy() {
      state.controller?.abort();
      urls.forEach((u) => URL.revokeObjectURL(u));
      container.removeEventListener('submit', onSubmit);
      container.removeEventListener('keydown', onKey);
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
    },
  };
}
