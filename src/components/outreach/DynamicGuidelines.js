// src/components/outreach/DynamicGuidelines.js
//
// After Create Dynamic Videos: how to record for the kind you picked (Multiple variables, AI greeting, Same audio),
// the language, then Record (Camera, Screen, Both, or upload) or "Test with our sample video". "Want to change
// something? Go Back" returns to Create Dynamic Videos.
const el = (tag, cls = '', txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};
const svg = (paths, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const CAMERA = '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>';
const CHEVRON = '<path d="m6 9 6 6 6-6"/>';

// What each kind asks of the recording. A `chips` line shows words as variable chips; an `example` line shows
// a spoken example with the words that get replaced highlighted.
export const GUIDELINES = Object.freeze({
  variables: {
    title: 'Multiple Variables Video Guidelines',
    steps: [
      { text: 'Record a “normal” video, using fallback words where your variables will go.', example: ['e.g. “Hey, ', ['there'], ', I was looking at your ', ['company'], '…”'] },
      { text: 'Keep in mind these are the variables you’ll be able to change later. (You can add them to your greeting and page in the next steps.)', chips: ['First name', 'Company', 'Job title', 'Last name'] },
      { text: 'Keep the video between 10 seconds and 2 minutes long for the best experience.' },
    ],
  },
  greeting: {
    title: 'AI Greeting Video Guidelines',
    steps: [
      { text: 'Leave a two-second pause at the very start. Each prospect’s greeting plays there, in your voice.', example: ['e.g. ', ['Hi Mike!'], ' … then “I made this short video for you…”'] },
      { text: 'Then speak naturally for at least 10 seconds, so your voice can be cloned from the recording.' },
      { text: 'Keep the video between 10 seconds and 2 minutes long for the best experience.' },
    ],
  },
  same: {
    title: 'Same Audio Video Guidelines',
    steps: [
      { text: 'Record a “normal” video. Everyone hears it exactly as you record it, without an AI voice.' },
      { text: 'Each prospect can still see their own website behind you and get their own landing page and link.', chips: ['Their website', 'Their page', 'Their link'] },
      { text: 'Keep the video between 10 seconds and 2 minutes long for the best experience.' },
    ],
  },
});

const RECORD_MODES = [['camera', 'Camera'], ['screen', 'Screen'], ['both', 'Camera and screen'], ['upload', 'Upload a video']];

/**
 * openGuidelines({ kind, language, languages: [[name, code]], onLanguage(name), onRecord(mode), onUpload(file),
 *   onSample(), onBack(), onClose() }) -> { close }
 */
export function openGuidelines({ kind = 'greeting', language = 'English', languages = [['English', 'en']], onLanguage = () => {}, onRecord = () => {}, onUpload = () => {}, onSample = () => {}, onBack = () => {}, onClose = () => {} } = {}) {
  const g = GUIDELINES[kind] || GUIDELINES.greeting;
  const overlay = el('div', 'fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/70 p-4');
  overlay.setAttribute('data-outreach-guidelines', kind);
  // "Want to change something? Go Back", above the dialog.
  const back = el('div', 'flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0c10] px-5 py-2.5 text-sm text-white/80 shadow-xl');
  const backBtn = el('button', 'font-semibold text-white/50 hover:text-primary', 'Go Back');
  backBtn.type = 'button';
  backBtn.setAttribute('data-guidelines-back', '');
  back.append(el('span', '', 'Want to change something?'), backBtn);
  const box = el('div', 'flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-white/10 bg-[#0b0c10] p-6 text-white shadow-2xl');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', g.title);
  const head = el('div', 'flex items-center justify-between');
  const x = el('button', 'rounded-lg px-2 py-1 text-xl leading-none text-white/60 hover:text-white', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close');
  head.append(el('h2', 'text-lg font-extrabold', g.title), x);

  const list = el('ol', 'flex flex-col divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] px-5');
  const num = (n) => el('span', 'grid h-6 w-6 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary', String(n));
  // 1: the language.
  const first = el('li', 'flex flex-wrap items-center gap-3 py-4');
  const select = el('select', 'rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-primary/50');
  select.setAttribute('aria-label', 'Language');
  select.setAttribute('data-guidelines-language', '');
  languages.forEach(([name]) => { const o = el('option', '', name); o.value = name; o.selected = name === language; select.appendChild(o); });
  select.addEventListener('change', () => onLanguage(select.value));
  first.append(num(1), el('span', 'text-[15px]', 'Choose your language:'), select);
  list.appendChild(first);
  g.steps.forEach((s, i) => {
    const li = el('li', 'flex flex-col gap-3 py-4');
    const top = el('div', 'flex items-start gap-3');
    top.append(num(i + 2), el('span', 'text-[15px] leading-relaxed', s.text));
    li.appendChild(top);
    if (s.example || s.chips) {
      const line = el('div', 'flex flex-wrap items-center gap-1 rounded-xl bg-white/[0.05] px-4 py-2.5 text-sm text-white/80');
      if (s.example) s.example.forEach((part) => line.appendChild(Array.isArray(part) ? el('span', 'rounded-md bg-primary/15 px-1.5 py-0.5 text-white', part[0]) : el('span', '', part)));
      if (s.chips) { line.appendChild(el('span', 'mr-1', kind === 'same' ? 'Personal for each prospect:' : 'Variables:')); s.chips.forEach((c) => line.appendChild(el('span', 'rounded-md bg-primary/15 px-1.5 py-0.5 text-white', c))); }
      li.appendChild(line);
    }
    list.appendChild(li);
  });

  // Record, with a menu of the other ways in (outlined with a lime edge, never filled).
  const split = el('div', 'relative flex');
  const rec = el('button', 'flex flex-1 items-center justify-center gap-2 rounded-l-full border border-r-0 border-white/[0.14] border-l-2 border-l-primary bg-transparent py-3.5 text-[15px] font-bold text-white hover:bg-white/[0.05]');
  rec.type = 'button';
  rec.setAttribute('data-guidelines-record', '');
  rec.innerHTML = `<span class="text-primary">${svg(CAMERA)}</span><span>Record</span>`;
  const more = el('button', 'grid w-12 place-items-center rounded-r-full border border-white/[0.14] text-white/70 hover:bg-white/[0.05] hover:text-white');
  more.type = 'button';
  more.setAttribute('aria-label', 'Other ways to add your video');
  more.setAttribute('aria-haspopup', 'menu');
  more.setAttribute('data-guidelines-more', '');
  more.innerHTML = svg(CHEVRON, 16);
  const menu = el('div', 'absolute bottom-full right-0 mb-2 hidden w-56 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#14151a] py-1 shadow-2xl');
  menu.setAttribute('role', 'menu');
  const file = el('input');
  file.type = 'file'; file.accept = 'video/*'; file.hidden = true;
  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) { close(); onUpload(f); } });
  RECORD_MODES.forEach(([mode, label]) => {
    const item = el('button', 'px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/[0.06] hover:text-white', label);
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('data-guidelines-mode', mode);
    item.addEventListener('click', () => { if (mode === 'upload') { file.click(); return; } close(); onRecord(mode); });
    menu.appendChild(item);
  });
  more.addEventListener('click', () => { menu.classList.toggle('hidden'); menu.classList.toggle('flex'); });
  rec.addEventListener('click', () => { close(); onRecord(kind === 'same' ? 'both' : 'camera'); });
  split.append(rec, more, menu, file);

  const shy = el('p', 'text-center text-sm text-white/70');
  const sample = el('button', 'font-semibold text-primary hover:underline', 'Test with our sample video!');
  sample.type = 'button';
  sample.setAttribute('data-guidelines-sample', '');
  sample.addEventListener('click', () => { close(); onSample(); });
  shy.append(document.createTextNode('Feeling shy? '), sample);

  box.append(head, list, split, shy);
  overlay.append(back, box);
  const onKey = (e) => { if (e.key === 'Escape') { close(); onClose(); } };
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey, true); }
  x.addEventListener('click', () => { close(); onClose(); });
  backBtn.addEventListener('click', () => { close(); onBack(); });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) { close(); onClose(); } });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  rec.focus();
  return { close };
}
