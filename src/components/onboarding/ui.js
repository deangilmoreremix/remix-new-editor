// src/components/onboarding/ui.js
// Small DOM helpers and Tailwind class strings shared by the onboarding screens. They match the Video Outreach
// welcome (outlined controls, a light lime tint for the chosen card) so both onboardings look the same.

export const el = (tag, cls = '', txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

export const svg = (paths, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  camera: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>',
  sparkles: '<path d="M10 3.5 11.8 8.2 16.5 10l-4.7 1.8L10 16.5l-1.8-4.7L3.5 10l4.7-1.8z"/><path d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15.5 14.6c2.4.1 4.2 1.6 4.8 4.4"/>',
  group: '<circle cx="8" cy="9" r="2.6"/><circle cx="16" cy="9" r="2.6"/><path d="M3 18.5c.5-2.6 2.4-4 5-4s4.5 1.4 5 4"/><path d="M11 18.5c.5-2.6 2.4-4 5-4s4.5 1.4 5 4"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  building: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9.5 21v-5.5h5V21"/><path d="M3 21h18"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M18.5 8.5a5 5 0 0 1 0 7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  back: '<path d="m14.5 6-6 6 6 6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  academy: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2V11"/><path d="M21.5 9v5"/>',
};

export const LOGO = `<div class="grid h-8 w-8 place-items-center rounded-lg bg-white p-1.5">${svg('<path d="M12 2 2 7l10 5 10-5-10-5Z" fill="black" stroke="none"/><path d="m2 17 10 5 10-5" stroke="black" stroke-width="2"/><path d="m2 12 10 5 10-5" stroke="black" stroke-width="2"/>', 22)}</div>`;

// Outlined, never filled; chosen = light lime tint.
const CARD = 'text-left rounded-2xl border bg-white/[0.02] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';
export const card = (on) => `${CARD} ${on ? 'border-primary/45 bg-primary/[0.07]' : 'border-white/10 hover:border-primary/35 hover:bg-white/[0.04]'}`;
export const INPUT = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-primary/50';
export const CTA = 'rounded-xl border border-white/[0.12] border-l-2 border-l-primary bg-transparent px-6 py-3.5 text-[15px] font-bold text-white hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35';
export const CHIP = (on) => `rounded-full border px-5 py-3 text-[15px] font-semibold transition-colors ${on ? 'border-primary/45 bg-primary/[0.08]' : 'border-white/10 hover:border-primary/35 hover:bg-white/[0.04]'}`;
