/**
 * 06 Mono editorial: black and white with one blue accent. Pixel-matched canvas design (styles/site/06-mono.css,
 * artwork in /landing-art/06). All names, figures and quotes are SAMPLE copy: replace before sending.
 * Must not import templates.js.
 */
const it = (title, extra = {}) => ({ title, ...extra });
const field = (key, label, type = 'text', required = true) => ({ key, label, type, required, placeholder: label });

export default {
  id: 'site-mono',
  name: 'Mono editorial',
  description: 'Black and white with one blue accent: bold headline, video with a greeting bubble, form, logo and results strip, features, testimonials, dashboard and checklist.',
  theme: { mode: 'light', accent: '#1445e6', highlight: '#1445e6', bg: '#ffffff', text: '#0b0b0b', font: 'system' },
  layout: 'site-mono', compose: 'site', canvas: 1672, customPlayer: true, adaptive: true, family: 'site', radius: 10,
  vars: { '--vp-s-hero': '#ffffff', '--vp-s-card': '#f5f5f5', '--vp-s-line': '#e6e6e6', '--vp-s-muted': '#555555', '--vp-surface': '#f4f4f4', '--vp-surface-2': '#ffffff', '--vp-line': '#d4d4d4' },
  site: {
    hero: {
      photo: '/landing-art/06/presenter.webp', variant: 'copy-video-form', eyebrow: 'Personalized Video Lead Generation',
      bullets: ['Build your list', 'Qualify leads', 'Book more calls'], chip: 'Hi Alex,\nI made this just for you.', actions: 'copy',
    },
    nav: { links: ['Product', 'Features', 'Use Cases', 'Pricing', 'Resources'].map((label) => ({ label, url: '' })), login: 'Log In', loginUrl: '', cta: 'Book a Call' },
    strip: { kind: 'logos', title: 'Trusted by growth-focused teams', items: [it('Helix'), it('Northview'), it('Crestline'), it('Modea'), it('Rivertide')] },
    cards: [
      { type: 'heading', w: 3, eyebrow: 'Build a high-quality list', title: 'Convert Viewers Into Leads', text: 'Create personal, relevant video experiences that drive opt-ins, grow your list, and bring in better-fit leads.' },
      {
 type: 'features', w: 9, items: [
        it('Personalized Videos', { icon: 'video', text: 'Record once, personalize at scale with names, company, and more.' }),
        it('High-Converting Opt-Ins', { icon: 'layers', text: 'Beautiful, distraction-free opt-in blocks that grow your list.' }),
        it('Lead Qualification', { icon: 'filter', text: 'Capture the right information and focus on high-intent leads.' }),
        it('Automated Workflows', { icon: 'bolt', text: 'Send videos, follow up, and move leads forward, on autopilot.' }),
      ] 
},
      {
 type: 'quotes', w: 4, title: 'What our customers say', items: [
        { text: 'The personalized videos increased our opt-in rate by 67% and filled our pipeline with better-fit leads.', by: 'Jamie R.', title: 'Head of Growth, Helix' },
        { text: "It feels personal, not promotional. We're building a higher-quality list and booking more calls.", by: 'Morgan K.', title: 'Marketing Director, Northview' },
      ] 
},
      { type: 'table', w: 4, chrome: ['Your leads at a glance', 'VideoLead', 'Lead Dashboard'], side: ['Dashboard', 'Leads', 'Videos', 'Opt-Ins', 'Automations'], kpis: [it('New Leads', { value: '1,248' }), it('Opt-In Rate', { value: '38.4%' }), it('Qualified Leads', { value: '842' })], cols: ['Last 30 days'], items: [] },
      { type: 'checklist', w: 4, title: 'Contact qualification checklist', items: [it('Captured name and email'), it('Company and role (optional)'), it('Interest or goal (e.g., demo, pricing, more info)'), it('Intent level (e.g., exploring, ready, high priority)'), it('Auto-route qualified leads to your calendar')] },
      { type: 'stats', w: 3, title: 'Results', items: [it('Higher opt-in rate', { value: '3.8×' }), it('More qualified leads', { value: '2.6×' }), it('More booked calls', { value: '54%' })] },
    ],
    band: { title: 'Get list-building tips, use cases, and product updates.', text: '', button: 'Subscribe', placeholder: 'Enter your email', social: 'Product Resources Company Contact', tagline: 'Personalized video, more leads' },
  },
  defaults: {
    headline: 'A Video That Speaks to You, [[Personally.]]',
    subhead: 'Turn personalized videos into qualified leads, bigger lists, and more conversations — automatically.',
    form: {
      title: 'Get Your Personalized Video', subtitle: 'See how personalized video can help you grow your list and generate more qualified leads.',
      submitLabel: 'Get My Video →', privacy: "We'll only use your info to send your personalized video.",
      fields: [field('name', 'First name'), field('email', 'Work email', 'email'), field('company', 'Company (optional)', 'text', false)],
    },
    ctas: [
      { label: 'Get My Personalized Video →', kind: 'form', value: '', style: 'primary' },
      { label: 'Book a Call', kind: 'calendar', value: '', style: 'secondary' },
    ],
  },
};
