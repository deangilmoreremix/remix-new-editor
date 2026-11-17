/** 06 Mono editorial: black and white with one blue accent. All names, figures and quotes are SAMPLE copy. */
const a = '/landing-art/06/';
const nav = { type: 'NavBar', props: { id: 'mono-nav', brand: 'SmartVideo AI', logo: `${a}logo.webp`, links: ['Product', 'Features', 'Use Cases', 'Pricing', 'Resources'].map((label) => ({ label, url: '' })), loginLabel: 'Log In', loginUrl: '', ctaLabel: 'Book a Call' } };
const hero = {
  type: 'MonoHero',
  props: {
    id: 'mono-hero', eyebrow: 'Personalized Video Lead Generation',
    headline: 'A Video That Speaks to You, [[Personally.]]',
    subhead: 'Turn personalized videos into qualified leads, bigger lists, and more conversations — automatically.',
    bullets: [{ text: 'Build your list' }, { text: 'Qualify leads' }, { text: 'Book more calls' }],
    buttons: [{ label: 'Get My Personalized Video →', url: '#lead', style: 'primary' }, { label: 'Book a Call', url: '#lead', style: 'secondary' }],
    greeting1: 'Hi [[Alex]],', greeting2: 'I made this just for you.', photo: `${a}presenter.webp`,
    formTitle: 'Get Your Personalized Video', formSubtitle: 'See how personalized video can help you grow your list and generate more qualified leads.',
    formFields: [{ key: 'name', label: 'First name', type: 'text', required: true }, { key: 'email', label: 'Work email', type: 'email', required: true }, { key: 'company', label: 'Company (optional)', type: 'text', required: false }],
    submitLabel: 'Get My Video →', privacy: "We'll only use your info to send your personalized video.",
  },
};
const proof = {
  type: 'MonoProof',
  props: {
    id: 'mono-proof', title: 'Trusted by growth-focused teams',
    logos: ['Helix', 'Northview', 'Crestline', 'Modea', 'Rivertide'].map((name, i) => ({ name, icon: `${a}l${i + 1}.webp` })),
    stats: [{ value: '3.8×', label: 'Higher opt-in rate' }, { value: '2.6×', label: 'More qualified leads' }, { value: '54%', label: 'More booked calls' }],
  },
};
const intro = {
  type: 'MonoIntro',
  props: {
    id: 'mono-intro', eyebrow: 'Build a high-quality list', title: 'Convert Viewers Into Leads',
    text: 'Create personal, relevant video experiences that drive opt-ins, grow your list, and bring in better-fit leads.',
    features: [
      { icon: `${a}f1.webp`, title: 'Personalized Videos', text: 'Record once, personalize at scale with names, company, and more.' },
      { icon: `${a}f2.webp`, title: 'High-Converting Opt-Ins', text: 'Beautiful, distraction-free opt-in blocks that grow your list.' },
      { icon: `${a}f3.webp`, title: 'Lead Qualification', text: 'Capture the right information and focus on high-intent leads.' },
      { icon: `${a}f4.webp`, title: 'Automated Workflows', text: 'Send videos, follow up, and move leads forward — on autopilot.' },
    ],
  },
};
const panels = {
  type: 'MonoPanels',
  props: {
    id: 'mono-panels',
    quotesTitle: 'What our customers say',
    quotes: [
      { text: 'The personalized videos increased our opt-in rate by 67% and filled our pipeline with better-fit leads.', name: 'Jamie R.', role: 'Head of Growth, Helix', avatar: `${a}av1.webp` },
      { text: "It feels personal, not promotional. We're building a higher-quality list and booking more calls.", name: 'Morgan K.', role: 'Marketing Director, Northview', avatar: `${a}av2.webp` },
    ],
    dashTitle: 'Your leads at a glance', dashBrand: 'VideoLead', dashLogo: `${a}logo.webp`, dashHeading: 'Lead Dashboard', dashRange: 'Last 30 days',
    dashMenu: [{ label: 'Dashboard', icon: 'home' }, { label: 'Leads', icon: 'users' }, { label: 'Videos', icon: 'video' }, { label: 'Opt-Ins', icon: 'mail' }, { label: 'Automations', icon: 'bolt' }],
    kpis: [{ label: 'New Leads', value: '1,248', delta: '↑ +67%' }, { label: 'Opt-In Rate', value: '38.4%', delta: '↑ +12.6 pp' }, { label: 'Qualified Leads', value: '842', delta: '↑ +58%' }],
    chart: `${a}chart.webp`,
    checkTitle: 'Contact qualification checklist',
    checks: [
      { label: 'Captured name and email', done: 'yes' }, { label: 'Company and role (optional)', done: 'yes' }, { label: 'Interest or goal (e.g., demo, pricing, more info)', done: 'yes' },
      { label: 'Intent level (e.g., exploring, ready, high priority)', done: 'yes' }, { label: 'Auto-route qualified leads to your calendar', done: 'no' },
    ],
  },
};
const band = { type: 'Band', props: { id: 'mono-band', brand: 'SmartVideo AI', tagline: '', title: 'Get list-building tips, use cases, and product updates.', text: '', placeholder: 'Enter your email', buttonLabel: 'Subscribe', social: 'Product Resources Company Contact' } };

export default {
  id: 'puck-mono',
  name: 'Mono editorial',
  description: 'Black and white editorial page with one blue accent: video with greeting bubble, form, logo and results strip, features, testimonials, dashboard and checklist (sample content).',
  designClass: 'mono',
  theme: { mode: 'light', accent: '#1445e6', highlight: '#1445e6', bg: '#ffffff', text: '#0b0b0b', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 10,
  puckData: { root: { props: { design: 'mono', accent: '#1445e6', background: '#ffffff', text: '#0b0b0b', surface: '#f5f5f5' } }, content: [nav, hero, proof, intro, panels, band], zones: {} },
};
