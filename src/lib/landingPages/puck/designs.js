/**
 * Editable-page templates: plain data (no React) so templates.js can list them.
 * `puckData` is the initial Puck page; every component prop in it is editable in the studio.
 */
const id = (n) => `${n}-starter`;
const hero = {
  type: 'Hero',
  props: {
    id: id('hero'),
    variant: 'copy-video-form',
    eyebrow: 'A video made for you',
    headline: 'Hi {{firstname|there}}, here is a smarter way to [[grow your business.]]',
    subhead: 'Press play for a short video, then tell us what you think.',
    bullets: [{ text: 'Made for {{company|your team}}' }, { text: 'Takes two minutes' }],
    buttons: [],
    chip: 'Hi {{firstname|there}}!',
    photo: '',
    showForm: 'yes',
    formTitle: 'Want to talk it through?',
    formSubtitle: 'Leave your details and we will be in touch.',
    formFields: [{ key: 'name', label: 'Your Name', type: 'text', required: true }, { key: 'email', label: 'Your Email', type: 'email', required: true }, { key: 'company', label: 'Your Company', type: 'text', required: false }],
    submitLabel: 'Send',
    privacy: '',
  },
};
const nav = { type: 'NavBar', props: { id: id('nav'), brand: 'Your brand', logo: '', links: [{ label: 'Product', url: '' }, { label: 'Pricing', url: '' }, { label: 'Resources', url: '' }], loginLabel: 'Log In', loginUrl: '', ctaLabel: 'Book a Demo' } };
const strip = { type: 'Strip', props: { id: id('strip'), kind: 'logos', title: 'Trusted by growth-focused teams', items: [{ title: 'Acme', text: '', value: '', icon: '' }, { title: 'Globex', text: '', value: '', icon: '' }, { title: 'Initech', text: '', value: '', icon: '' }] } };
const grid = {
  type: 'Grid',
  props: {
    id: id('grid'),
    columns: 3,
    items: [
      { type: 'LeadMagnetCard', props: { id: id('magnet'), columns: 1, tag: 'FREE RESOURCE', title: 'Get the free playbook', cover: 'The Personalized Video Playbook', text: 'A short guide with templates and scripts.', placeholder: 'Enter your email', buttonLabel: 'Send me the playbook' } },
      { type: 'FeaturesCard', props: { id: id('feats'), columns: 1, title: 'Key features', items: [{ icon: 'video', title: 'Personalized video', text: 'One-to-one videos in minutes.' }, { icon: 'chart', title: 'Insights', text: 'Track views and replies.' }] } },
      { type: 'QuoteCard', props: { id: id('quote'), columns: 1, heading: 'What people say', quotes: [{ text: 'Add a quote you have permission to use.', name: 'Name', role: 'Role, Company' }] } },
    ],
  },
};
const band = { type: 'Band', props: { id: id('band'), brand: '', tagline: '', title: 'Get tips and updates in your inbox', text: '', placeholder: 'Enter your email', buttonLabel: 'Subscribe', social: '' } };
const footer = { type: 'Footer', props: { id: id('footer'), text: 'Sent by {{sender|us}}', links: [] } };

const STARTER = [
  {
    id: 'puck-starter',
    name: 'Editable landing page',
    description: 'A responsive landing page you edit visually: add, remove and reorder sections and change every word, image and link.',
    theme: { mode: 'light', accent: '#2563eb', highlight: '#2563eb', bg: '#ffffff', text: '#0f172a', font: 'system' },
    layout: 'puck',
    puck: true,
    radius: 14,
    puckData: { root: { props: { design: 'clean', accent: '#2563eb', background: '#ffffff', text: '#0f172a', surface: '' } }, content: [nav, hero, strip, grid, band, footer], zones: {} },
  },
];

// One file per converted design (puck/designs/NN-name.js, default export = a template object), registered automatically.
const EXTRA = Object.entries(import.meta.glob('./designs/*.js', { eager: true }))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, m]) => m.default)
  .filter(Boolean);

export const PUCK_TEMPLATES = [...STARTER, ...EXTRA];
