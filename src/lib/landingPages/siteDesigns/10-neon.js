/**
 * Template 10: "Neon KPI". Dark navy with cyan/violet neon. Above y=405 it follows the supplied design;
 * the sections below the fold (strip, table, stats, quotes, band) are continued in the same family from
 * existing card types and are NOT from the supplied design. All names and figures are SAMPLE copy.
 */
const it = (title, extra = {}) => ({ title, ...extra });
const quote = (text, by, role, w = 3) => ({ type: 'quotes', w, items: [{ text, by, title: role }] });
const fields = [
  { key: 'name', label: 'Your First Name', type: 'text', required: true, placeholder: 'Your First Name' },
  { key: 'email', label: 'Your Email Address', type: 'email', required: true, placeholder: 'Your Email Address' },
  { key: 'company', label: 'Company (Optional)', type: 'text', required: false, placeholder: 'Company (Optional)' },
];

export default {
  id: 'site-neon',
  name: 'Neon KPI',
  description: 'Dark navy neon: headline, glowing video, demo form and a live-style leads counter with a playbook gift card.',
  theme: { mode: 'dark', accent: '#19e6ee', highlight: '#a78bfa', bg: '#070c24', text: '#f1f5ff', font: 'system' },
  layout: 'site-neon', compose: 'site', canvas: 1672, customPlayer: true, adaptive: true, family: 'site', radius: 16,
  vars: { '--vp-s-hero': 'radial-gradient(1000px 420px at 0% 0%, rgba(124,58,237,.4), transparent 60%), radial-gradient(800px 420px at 100% 10%, rgba(25,230,238,.22), transparent 55%), #070c24', '--vp-s-card': 'rgba(255,255,255,.05)', '--vp-s-line': 'rgba(130,140,255,.3)', '--vp-s-muted': '#b9c2e6', '--vp-surface': '#11173f', '--vp-surface-2': '#0b1030', '--vp-line': 'rgba(130,140,255,.3)' },
  approx: { surface: '#11173f' },
  site: {
    hero: { photo: '/landing-art/10/presenter.webp', variant: 'copy-video-form', eyebrow: 'Personalized Video Lead Generation', bullets: ['AI-powered video personalization', 'Built-in lead capture & list building', 'Automated follow-ups & nurturing'], chip: 'Hi {{firstname|there}}, this video is just for you!', actions: 'form' },
    nav: { links: ['Product', 'Solutions', 'Pricing', 'Resources'].map((label) => ({ label, url: '' })), login: 'Log In', loginUrl: '', cta: 'Start Free Trial' },
    strip: { kind: 'benefits', title: '', items: [it('Personalized Video at Scale', { icon: 'video' }), it('Build & Grow Your List', { icon: 'users' }), it('Automated Lead Capture', { icon: 'bolt' }), it('Lead Tracking & Mini CRM', { icon: 'layers' }), it('Book More Sales Calls', { icon: 'calendar' })] },
    cards: [
      { type: 'kpi', w: 4, title: 'Leads Captured (All Time)', value: '128,349', text: '+37% (Last 30 days)' },
      { type: 'playbook', w: 4, title: 'Join Our Insider List & Get a Free "Personalized Video Playbook"', cover: 'The Personalized Video Playbook', text: '', button: 'Get the Free Playbook', placeholder: 'Enter your email' },
      { type: 'table', w: 6, title: 'Lead Tracker (Mini CRM)', chrome: ['{{brand}}', 'Lead Tracker (Mini CRM)'], side: ['Leads', 'Videos', 'Campaigns', 'Reports'], cols: ['Lead', 'Company', 'Engagement', 'Status'], items: [it('Sarah Chen', { text: 'Acme Co.', value: '100% watched', tag: 'Hot Lead' }), it('James Miller', { text: 'BrightTech', value: '87% watched', tag: 'Contacted' }), it('Elena Rodriguez', { text: 'GrowthLabs', value: '72% watched', tag: 'Nurturing' })] },
      { type: 'stats', w: 6, title: 'Real Results for Growth-Minded Businesses', items: [it('Lead Conversion', { value: '+317%', icon: 'target' }), it('List Growth', { value: '+4.2x', icon: 'users' }), it('More Booked Calls', { value: '68%', icon: 'calendar' }), it('Pipeline Value', { value: '+289%', icon: 'chart' })] },
      quote('Our email list grew by 3x in 30 days and the personalized videos get way more replies than standard emails.', 'Melissa Grant', 'CEO, Grant Marketing', 4),
      quote('Made it simple to create personalized outreach at scale. More leads, more calls, more real opportunities.', 'Ryan Carter', 'Founder, Carter Growth', 4),
      quote('The built-in lead tracking and automation is a game-changer. Like a marketing assistant that never sleeps.', 'Priya Desai', 'CMO, Elevate Brands', 4),
    ],
    band: { title: 'Join 10,000+ marketers getting higher-quality leads with personalized video.', text: '', button: 'Get Started Free', placeholder: 'Enter your email address', social: '', tagline: '' },
  },
  defaults: {
    headline: 'Turn Every Prospect Into a Warm Lead With [[Personalized Video]]',
    subhead: 'Create, send, and track AI-personalized videos at scale. Build your email list, capture more leads, and grow revenue, all in one platform.',
    form: { title: 'Get Your Personalized Video & Grow Your Lead List', subtitle: '', submitLabel: 'Create My Personalized Video', privacy: '', fields },
    ctas: [{ label: 'Book a Live Walkthrough', kind: 'calendar', value: '', style: 'secondary' }],
  },
};
