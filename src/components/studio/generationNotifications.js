// Generation notification stack, ported from upstream Open-Generative-AI's
// shell (components/StandaloneShell.js): a top-right stack showing one
// "running" card while generations are in flight, and success / error cards
// with an "Open" link back to the studio. At most 3 cards, 12s each, kept
// across reloads.
//
// Studios report progress with notifyGeneration({ phase, studio, label, url, message }).

const STORAGE_KEY = 'smartvideo_generation_notifications';
const EVENT = 'studio:generation';
const MAX_CARDS = 3;
const TTL_MS = 12000;

let running = new Map(); // id -> { studio, label }
let cards = [];          // { id, type, studio, label, url, message, expiresAt }
let host = null;
let timer = null;
let navigateFn = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const now = Date.now();
    cards = Array.isArray(saved) ? saved.filter((c) => c.expiresAt > now).slice(0, MAX_CARDS) : [];
  } catch { cards = []; }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)); } catch { /* ignore */ }
}

function render() {
  if (!host) return;
  host.innerHTML = '';
  if (running.size) {
    const first = running.values().next().value;
    const el = card({ type: 'running', label: first.label, message: running.size > 1 ? `${running.size} generations running` : 'Generating…' });
    host.appendChild(el);
  }
  cards.forEach((c) => host.appendChild(card(c)));
}

function card(c) {
  const el = document.createElement('div');
  el.dataset.notification = c.type;
  el.className = 'w-full rounded-xl border border-primary/40 bg-white text-black shadow-2xl p-3 flex items-start gap-3 pointer-events-auto animate-slide-in-right';
  const icon = document.createElement('div');
  icon.className = `w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-black text-primary'}`;
  icon.innerHTML = c.type === 'running'
    ? '<span class="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></span>'
    : c.type === 'error'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
  const body = document.createElement('div');
  body.className = 'min-w-0 flex-1';
  const title = document.createElement('div');
  title.className = 'text-sm font-bold truncate';
  title.textContent = c.label || 'Generation';
  const msg = document.createElement('div');
  msg.className = 'text-xs text-black/60 line-clamp-2';
  msg.textContent = c.message || (c.type === 'error' ? 'Generation failed' : 'Ready');
  body.append(title, msg);
  el.append(icon, body);
  if (c.type !== 'running' && c.studio) {
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'text-xs font-bold underline shrink-0 self-center';
    open.textContent = 'Open';
    open.onclick = () => { dismiss(c.id); navigateFn?.(c.studio); };
    el.appendChild(open);
  }
  return el;
}

function schedule() {
  clearTimeout(timer);
  if (!cards.length) return;
  const next = Math.min(...cards.map((c) => c.expiresAt));
  timer = setTimeout(() => {
    const now = Date.now();
    cards = cards.filter((c) => c.expiresAt > now);
    save(); render(); schedule();
  }, Math.max(0, next - Date.now()));
}

function dismiss(id) {
  cards = cards.filter((c) => c.id !== id);
  save(); render(); schedule();
}

function handle({ phase, id, studio, label, url, message }) {
  const key = id || `${studio}:${label}`;
  if (phase === 'start') {
    running.set(key, { studio, label });
  } else {
    running.delete(key);
    cards = [{ id: `${key}:${Date.now()}`, type: phase === 'error' ? 'error' : 'success', studio, label, url, message, expiresAt: Date.now() + TTL_MS }, ...cards].slice(0, MAX_CARDS);
    save(); schedule();
  }
  render();
}

/** Report a generation lifecycle event from a studio. */
export function notifyGeneration(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

/** Mount once from main.js. `navigate(route)` powers the Open links. */
export function mountGenerationNotifications(navigate) {
  if (host || typeof document === 'undefined') return host;
  navigateFn = navigate;
  host = document.createElement('div');
  host.className = 'fixed top-16 right-5 z-[120] w-[340px] max-w-[calc(100vw-2.5rem)] flex flex-col gap-2 pointer-events-none';
  host.setAttribute('aria-live', 'polite');
  host.dataset.generationNotifications = '';
  document.body.appendChild(host);
  load();
  window.addEventListener(EVENT, (e) => handle(e.detail || {}));
  render(); schedule();
  return host;
}

// Test hook
export function __resetGenerationNotifications() {
  host?.remove(); host = null; running = new Map(); cards = []; clearTimeout(timer);
}
