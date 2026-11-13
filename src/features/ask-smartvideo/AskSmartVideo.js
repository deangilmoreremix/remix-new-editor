// Ask SmartVideo — floating help assistant (vanilla DOM, mounted once in main.js).
//
// Grounded in the studio registry via /api/ask-smartvideo (retrieval + the
// user's own OpenAI key). Source chips navigate with the SPA router, so the
// conversation survives moving between studios; history is kept in
// sessionStorage for the tab.
import { apiKeyManager } from '../../lib/apiKeyManager.js';
import { openaiKeyHeader } from '../../lib/openaiKeyHeader.js';
import { getStudioLabel, getNavItemForRoute } from '../../lib/studioRoutes.js';
import { ENDPOINT, renderAnswer, parseSSE, starterPrompts, pickChips, pageOf, isAcademyUrl, journeyPrompts } from './askCore.js';

const STORE = 'askSmartVideo:v1';
const MAX_LEN = 1500;

const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)) || []; } catch { return []; } };
const save = (m) => { try { sessionStorage.setItem(STORE, JSON.stringify(m.slice(-30))); } catch { /* storage unavailable */ } };

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

/**
 * @param {{ navigate: (page: string) => void, getPage: () => string }} deps
 */
export function mountAskSmartVideo({ navigate, getPage }) {
  if (document.getElementById('ask-smartvideo-root')) return;
  let messages = load(); // { role, content, sources? }
  let busy = false;
  let abort = null;

  const root = document.createElement('div');
  root.id = 'ask-smartvideo-root';
  root.innerHTML = `
    <style>
      #ask-smartvideo-root .ask-body a.ask-cite{display:inline-block;min-width:16px;padding:0 4px;margin:0 1px;border-radius:6px;background:rgba(217,255,0,.15);color:#d9ff00;font-size:11px;text-align:center;text-decoration:none}
      /* Desktop: the panel takes the launcher's corner (the launcher hides while it is open). */
      @media (min-width:640px){#ask-smartvideo-root [data-ask="panel"]{bottom:1.25rem;max-height:calc(100vh - 2.5rem)}}
      #ask-smartvideo-root .ask-body p{margin:0 0 .5rem}#ask-smartvideo-root .ask-body ol,#ask-smartvideo-root .ask-body ul{margin:0 0 .5rem 1.1rem;padding:0}
      #ask-smartvideo-root .ask-body ol{list-style:decimal}#ask-smartvideo-root .ask-body ul{list-style:disc}
      #ask-smartvideo-root .ask-body code{background:rgba(255,255,255,.08);padding:0 4px;border-radius:4px}
    </style>
    <button type="button" data-ask="launcher" aria-label="Ask SmartVideo" aria-expanded="false"
      class="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-black shadow-lg hover:bg-primary-hover transition-colors">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span>Ask SmartVideo</span>
    </button>
    <section data-ask="panel" role="dialog" aria-label="Ask SmartVideo" hidden
      class="fixed inset-0 sm:inset-auto sm:right-5 z-[70] flex flex-col bg-panel-bg border border-white/10 sm:rounded-2xl shadow-2xl sm:w-[400px] sm:h-[600px]">
      <header class="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div><div class="text-sm font-semibold text-white">Ask SmartVideo</div><div data-ask="context" class="text-xs text-muted"></div></div>
        <div class="flex gap-1">
          <button type="button" data-ask="clear" class="text-xs text-secondary hover:text-white px-2 py-1 rounded-lg hover:bg-white/5">Clear</button>
          <button type="button" data-ask="close" aria-label="Close" class="text-secondary hover:text-white px-2 py-1 rounded-lg hover:bg-white/5">✕</button>
        </div>
      </header>
      <div data-ask="log" class="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar" aria-live="polite"></div>
      <div data-ask="keycard" hidden class="mx-4 mb-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-white">
        <strong>Add your OpenAI key to get an answer.</strong> Ask SmartVideo uses your own OpenAI key. <button type="button" data-ask="settings" class="underline text-primary">Open API keys</button>
      </div>
      <form data-ask="form" class="flex items-end gap-2 border-t border-white/10 p-3">
        <textarea data-ask="input" rows="1" maxlength="${MAX_LEN}" placeholder="Ask about any studio…" aria-label="Your question"
          class="flex-1 resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/60 max-h-28"></textarea>
        <button type="submit" data-ask="send" class="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">Send</button>
      </form>
      <p class="px-3 pb-3 -mt-1 text-[10px] leading-snug text-muted">Uses your own OpenAI key — usage is billed to your OpenAI account. AI answers can be wrong; check the linked page. Never paste API keys here.</p>
    </section>`;
  document.body.appendChild(root);

  const $ = (k) => root.querySelector(`[data-ask="${k}"]`);
  const panel = $('panel'); const log = $('log'); const input = $('input'); const sendBtn = $('send'); const keycard = $('keycard');

  const studioId = () => getNavItemForRoute(getPage()) || null;
  const ctx = () => (studioId() ? `Help for ${getStudioLabel(studioId())} and the whole app` : 'Help for every studio, the Academy and more');
  const bubble = (role, html) => {
    const d = document.createElement('div');
    d.className = role === 'user' ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/90 text-black px-3 py-2 text-sm whitespace-pre-wrap' : 'ask-body max-w-[95%] rounded-2xl rounded-bl-sm bg-white/5 text-white px-3 py-2 text-sm';
    if (role === 'user') d.textContent = html; else d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  };
  const chipsFor = (answer, sources) => {
    const { cited, chips } = pickChips(answer, sources || []);
    if (!chips.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-wrap items-center gap-1.5 pt-1';
    const lab = document.createElement('span'); lab.className = 'text-[11px] text-muted'; lab.textContent = cited ? 'Sources' : 'Related pages'; wrap.appendChild(lab);
    chips.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.askUrl = c.url;
      b.className = c.academy || isAcademyUrl(c.url)
        ? 'rounded-full border border-purple-400/40 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-200 hover:border-purple-300'
        : 'rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white hover:border-primary/50';
      b.textContent = c.label;
      wrap.appendChild(b);
    });
    return wrap;
  };

  function renderAll() {
    $('context').textContent = ctx();
    keycard.hidden = apiKeyManager.hasOpenAIKey();
    log.innerHTML = '';
    if (!messages.length) {
      const intro = bubble('assistant', renderAnswer('Ask how to do anything in SmartVideo. Answers come from our studio guides and Academy courses, and link to the page they came from.'));
      const w = document.createElement('div'); w.className = 'flex flex-col gap-1.5 pt-1';
      starterPrompts(studioId()).forEach((q) => {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.askStarter = q; b.textContent = q;
        b.className = 'text-left rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:border-primary/50';
        w.appendChild(b);
      });
      intro.appendChild(w);
      // Guided walkthroughs that chain studios into a finished video.
      const journeys = journeyPrompts();
      if (journeys.length) {
        const head = document.createElement('div');
        head.className = 'pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted';
        head.textContent = 'Make a video';
        const jw = document.createElement('div');
        jw.className = 'flex flex-col gap-1.5 pt-1';
        journeys.forEach((j) => {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.askStarter = j.prompt; b.dataset.askJourney = j.id; b.textContent = j.title;
          b.className = 'text-left rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-white hover:border-primary/60';
          jw.appendChild(b);
        });
        intro.appendChild(head);
        intro.appendChild(jw);
      }
      return;
    }
    messages.forEach((m) => {
      if (m.role === 'user') return bubble('user', m.content);
      const b = bubble('assistant', renderAnswer(m.content, m.sources));
      const c = chipsFor(m.content, m.sources); if (c) b.appendChild(c);
    });
  }

  async function ask(text) {
    text = String(text || '').trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    if (!apiKeyManager.hasOpenAIKey()) { keycard.hidden = false; return; }
    busy = true; sendBtn.disabled = true;
    messages.push({ role: 'user', content: text });
    const turn = { role: 'assistant', content: '', sources: [] };
    messages.push(turn);
    renderAll();
    const out = log.lastElementChild;
    out.textContent = '…';
    abort = new AbortController();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...openaiKeyHeader() },
        body: JSON.stringify({ messages: messages.slice(0, -1).map(({ role, content }) => ({ role, content })), studioId: studioId() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.code === 'need_key') keycard.hidden = false;
        throw new Error(res.status === 401 ? 'Please sign in to use Ask SmartVideo.' : j.error || 'Ask SmartVideo is unavailable right now. Try again in a moment.');
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        const { events, rest } = parseSSE(buf); buf = rest;
        for (const { event, data } of events) {
          if (event === 'sources') turn.sources = data;
          else if (event === 'delta') { turn.content += data.text; out.innerHTML = renderAnswer(turn.content, turn.sources); log.scrollTop = log.scrollHeight; }
          else if (event === 'error') throw new Error(data.message);
        }
        if (done) break;
      }
      out.innerHTML = renderAnswer(turn.content, turn.sources);
      const c = chipsFor(turn.content, turn.sources); if (c) out.appendChild(c);
    } catch (err) {
      if (err.name === 'AbortError') { /* cleared or closed */ } else {
        turn.content = turn.content || err.message || 'Something went wrong.';
        out.innerHTML = renderAnswer(turn.content, []);
      }
    } finally {
      busy = false; sendBtn.disabled = false; abort = null;
      save(messages.filter((m) => m.content));
    }
  }

  const setOpen = (open) => {
    panel.hidden = !open;
    $('launcher').setAttribute('aria-expanded', String(open));
    $('launcher').style.display = open ? 'none' : '';
    if (open) { renderAll(); input.focus(); }
  };
  const go = (url) => {
    if (isAcademyUrl(url)) window.location.hash = url; // the Academy page parses its own hash path
    else if (pageOf(url) === 'settings') window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'settings' } }));
    else navigate(pageOf(url));
    if (window.matchMedia('(max-width: 639px)').matches) setOpen(false);
  };

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ask-url],[data-ask-starter],[data-ask]');
    if (!t) return;
    if (t.dataset.askUrl) { e.preventDefault(); return go(t.dataset.askUrl); }
    if (t.dataset.askStarter) return ask(t.dataset.askStarter);
    const k = t.dataset.ask;
    if (k === 'launcher') setOpen(panel.hidden);
    else if (k === 'close') setOpen(false);
    else if (k === 'settings') go('#/settings');
    else if (k === 'clear') { abort?.abort(); messages = []; save([]); renderAll(); }
  });
  $('form').addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; input.style.height = ''; ask(v); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('form').requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 112)}px`; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
  // Keep "You're in <studio>" and the starters current as the user moves around.
  window.addEventListener('hashchange', () => { if (!panel.hidden && !busy && !messages.length) renderAll(); else if (!panel.hidden) $('context').textContent = ctx(); });
}
