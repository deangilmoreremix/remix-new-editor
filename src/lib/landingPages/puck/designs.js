/**
 * Editable-page templates: plain data (no React) so templates.js can list them.
 * `puckData` is the initial Puck page; every component prop in it is editable in the studio.
 */
const hero = {
  type: 'Hero',
  props: {
    id: 'hero-starter',
    eyebrow: 'A video made for you',
    headline: 'Hi {{firstname|there}}, here is a smarter way to [[grow your business.]]',
    subhead: 'Press play for a short video, then tell us what you think.',
    bullets: [{ text: 'Made for {{company|your team}}' }, { text: 'Takes two minutes' }],
    chip: 'Hi {{firstname|there}}!',
    photo: '',
    formTitle: 'Want to talk it through?',
    formSubtitle: 'Leave your details and we will be in touch.',
    submitLabel: 'Send',
    ctaLabel: '',
    ctaUrl: '',
  },
};

export const PUCK_TEMPLATES = [
  {
    id: 'puck-starter',
    name: 'Editable landing page',
    description: 'A responsive landing page you edit visually: add, remove and reorder sections and change every word, image and link.',
    theme: { mode: 'light', accent: '#2563eb', highlight: '#2563eb', bg: '#ffffff', text: '#0f172a', font: 'system' },
    layout: 'puck',
    puck: true,
    radius: 14,
    puckData: { root: { props: { accent: '#2563eb', background: '#ffffff', text: '#0f172a' } }, content: [hero], zones: {} },
  },
];
