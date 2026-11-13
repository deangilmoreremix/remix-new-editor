import { mountStudioChrome } from '../lib/studioChrome.js';
import { parseCSV, renderScript, SCRIPT_TOKENS } from '../lib/personalizedVideoEngine.js';

const DEFAULT_SCRIPT = 'Hey {{first_name}}, I made this quick video for you and the team at {{company}}.';

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text; // never innerHTML: CSV data is untrusted
  return n;
}

export function PersonalizedVideoStudio() {
  const container = el('div', 'w-full h-full flex flex-col items-center bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar');
  mountStudioChrome(container, { currentRoute: 'personalized-video' });

  let contacts = [];
  const wrap = el('div', 'w-full max-w-4xl flex flex-col gap-4');
  wrap.appendChild(el('h1', 'text-2xl font-bold text-white', 'Personalized Video'));
  wrap.appendChild(el('p', 'text-sm text-white/60', 'Record once, then personalize the intro for every contact. Import contacts, write a script with tokens, preview each version.'));

  // Step 1: contacts
  const contactsCard = el('section', 'rounded-xl border border-white/10 p-4 flex flex-col gap-2');
  contactsCard.appendChild(el('h2', 'font-semibold text-white', '1. Contacts (CSV)'));
  const file = el('input', 'text-sm text-white/80');
  file.type = 'file';
  file.accept = '.csv,text/csv';
  const contactsInfo = el('p', 'text-xs text-white/60', 'No contacts imported yet. Columns: First Name, Company, Email, Website...');
  contactsCard.append(file, contactsInfo);

  // Step 2: script
  const scriptCard = el('section', 'rounded-xl border border-white/10 p-4 flex flex-col gap-2');
  scriptCard.appendChild(el('h2', 'font-semibold text-white', '2. Script template'));
  const script = el('textarea', 'w-full min-h-[90px] rounded-lg bg-black/30 border border-white/10 p-2 text-sm text-white');
  script.value = DEFAULT_SCRIPT;
  script.maxLength = 4000;
  scriptCard.append(script, el('p', 'text-xs text-white/50', 'Tokens: ' + SCRIPT_TOKENS.map(t => `{{${t}}}`).join('  ')));

  // Step 3: preview
  const previewCard = el('section', 'rounded-xl border border-white/10 p-4 flex flex-col gap-2');
  previewCard.appendChild(el('h2', 'font-semibold text-white', '3. Preview'));
  const list = el('ul', 'flex flex-col gap-1 text-sm text-white/80');
  previewCard.appendChild(list);

  function refresh() {
    list.replaceChildren();
    contactsInfo.textContent = contacts.length ? `${contacts.length} contacts imported.` : 'No contacts imported yet.';
    contacts.slice(0, 20).forEach(c => {
      const { text, missing } = renderScript(script.value, c);
      const li = el('li', 'rounded bg-white/5 px-2 py-1');
      li.appendChild(el('span', '', text));
      if (missing.length) li.appendChild(el('span', 'ml-2 text-amber-400 text-xs', `missing: ${missing.join(', ')}`));
      list.appendChild(li);
    });
  }

  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { contactsInfo.textContent = 'File too large (max 5 MB).'; return; }
    contacts = parseCSV(await f.text());
    refresh();
  });
  script.addEventListener('input', refresh);

  wrap.append(contactsCard, scriptCard, previewCard);
  container.appendChild(wrap);
  refresh();
  return container;
}
