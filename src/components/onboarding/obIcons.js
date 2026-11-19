// src/components/onboarding/obIcons.js
// Small helpers and the line-icon set for the onboarding (see src/styles/onboarding.css).
export const el = (tag, cls = '', txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

export const svg = (paths, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  camera: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>',
  sparkles: '<path d="M9.5 3.5 11.2 8.3 16 10l-4.8 1.7L9.5 16.5 7.8 11.7 3 10l4.8-1.7z"/><path d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15.5 14.6c2.4.1 4.2 1.6 4.8 4.4"/>',
  group: '<circle cx="8" cy="9" r="2.6"/><circle cx="16" cy="9" r="2.6"/><path d="M3 18.5c.5-2.6 2.4-4 5-4s4.5 1.4 5 4"/><path d="M11 18.5c.5-2.6 2.4-4 5-4s4.5 1.4 5 4"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  building: '<path d="M4 21V10l8-6 8 6v11"/><path d="M9.5 21v-6h5v6"/><path d="M3 21h18"/>',
  back: '<path d="m14.5 6-6 6 6 6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  cap: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2V11"/><path d="M21.5 9v5"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/><path d="M8.5 12.2c1.9 1.5 5.1 1.5 7 0"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  send: '<path d="M21 4 3 11l7 2.5L12.5 21z"/><path d="m10 13.5 11-9.5"/>',
  wand: '<path d="m4 20 11-11"/><path d="m14 4 1 2.2 2.2 1-2.2 1L14 10.4l-1-2.2-2.2-1 2.2-1z"/><path d="M19 13l.7 1.5L21 15l-1.3.5L19 17l-.7-1.5L17 15l1.3-.5z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
};

/** The SmartVideo mark (white rounded square with the layered-stack icon, as in the app header) and wordmark. */
export const logo = () => {
  const n = el('div', 'ob-logo');
  n.innerHTML = `<span class="ob-logo-mark"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5Z" fill="#000"/><path d="m2 17 10 5 10-5" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m2 12 10 5 10-5" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>SmartVideo</span>`;
  return n;
};

/** Icon for each video type card in step 6a. */
export const TYPE_ICONS = {
  'text-to-video': 'camera', talking: 'user', cinematic: 'film', effects: 'sparkles',
  product: 'bag', outreach: 'send', 'agent-edit': 'wand', images: 'image',
};
