/**
 * Design 07: "Street poster". Magenta / orange / purple poster look with a tilted video frame, torn-paper
 * sections, agency case studies and a chevron pipeline row. DATA only; styled in styles/site/07-poster.css.
 * All names, figures and quotes are SAMPLE copy. Replace before sending.
 */
const it = (title, extra = {}) => ({ title, ...extra });
const field = (key, label, type = 'text', required = true) => ({ key, label, type, required, placeholder: label });

export default {
  id: 'site-poster',
  name: 'Street poster',
  description: 'Loud magenta, orange and purple poster look: tilted video, form card, agency logos, torn-paper case studies and a chevron pipeline.',
  theme: { mode: 'light', accent: '#d6177f', highlight: '#ffd60a', bg: '#fbf9fd', text: '#1c0f3a', font: 'display' },
  layout: 'site-poster', compose: 'site', canvas: 1672, customPlayer: true, adaptive: true, family: 'site', radius: 10,
  vars: { '--vp-s-hero': 'linear-gradient(110deg, #3b1175 0%, #9a1fa6 55%, #ff7a30 100%)', '--vp-s-card': '#ffffff', '--vp-s-line': '#eadcf5', '--vp-s-muted': '#5a4a6e', '--vp-surface': '#ffffff', '--vp-surface-2': '#f6effb', '--vp-line': '#eadcf5' },
  site: {
    hero: { photo: '/landing-art/07/presenter.webp', variant: 'copy-video-form', eyebrow: 'Personalized video at scale', bullets: ['Personalized at scale', 'Higher response rates', 'More booked meetings'], chip: 'Hey {{firstname|there}}!', actions: 'copy' },
    nav: { links: ['How It Works', 'Case Studies', 'Features', 'Pricing', 'Resources'].map((label) => ({ label, url: '' })), login: '', loginUrl: '', cta: 'Book a Strategy Call' },
    strip: { kind: 'logos', title: 'Trusted by growth-focused agencies & brands', items: [it('NorthPeak'), it('Brightside'), it('ScaleHouse'), it('Momentum'), it('LaunchLab')] },
    cards: [
      { type: 'heading', w: 4, title: 'Everything You Need to Generate Leads with Video', text: 'A full lead generation system — from contact import to personalized video creation to a booked pipeline.' },
      {
 type: 'features', w: 8, title: '', items: [
        it('Personalized Videos at Scale', { icon: 'video', text: 'Create 1:1 videos for hundreds or thousands of contacts.' }),
        it('Higher Response Rates', { icon: 'bolt', text: 'Cut through the noise with a personal, human touch.' }),
        it('More Booked Meetings', { icon: 'target', text: 'Turn views into conversations, demos, and sales calls.' }),
        it('Agency-Ready & Done-for-You', { icon: 'layers', text: 'White-labeled, campaign support, and creative execution from our team.' }),
      ] 
},
      { type: 'heading', w: 4, title: 'Agency Case Studies', text: 'Real results from teams using personalized video to build pipeline.' },
      { type: 'stats', w: 3, title: 'NorthPeak', items: [it('More Replies', { value: '+317%' }), it('Booked Meetings', { value: '+4.2x' })] },
      { type: 'stats', w: 3, title: 'Brightside', items: [it('Lead Conversion', { value: '+268%' }), it('Pipeline Value', { value: '+6.1x' })] },
      { type: 'quotes', w: 4, title: '', items: [{ text: 'This completely changed our outreach. The personalized videos feel high-touch, but we’re sending them at scale and booking more meetings than ever.', by: 'Jordan Ellis', title: 'CEO, ScaleHouse Agency' }] },
      { type: 'heading', w: 4, title: 'Your Lead Pipeline, Visualized', text: 'From contacts to conversations to closed deals.' },
      { type: 'steps', w: 6, title: '', items: [it('Import Contacts', { icon: 'users' }), it('Create Personalized Videos', { icon: 'play' }), it('Launch Outreach', { icon: 'send' }), it('Book Meetings', { icon: 'calendar' }), it('Fill Your Pipeline', { icon: 'chart' })] },
      { type: 'checklist', w: 8, title: 'Bring Your Contacts. We’ll Do the Rest.', text: 'Import your existing leads and instantly create personalized video outreach campaigns.', items: [it('Works with your existing contact lists'), it('Map personalized fields (name, company, etc.)'), it('Launch your first campaign in minutes')] },
      { type: 'heading', w: 2, title: 'Import Contacts', text: 'Drag & drop a CSV, or click to upload' },
    ],
    band: { title: 'Ready to Turn More Contacts into Customers?', text: '', button: 'Get Started Free', placeholder: 'Enter your email', social: 'Book a Strategy Call' },
  },
  defaults: {
    headline: 'Turn Cold\nContacts Into [[Hot Leads]] With Personalized\nVideo',
    subhead: 'A done-for-you personalized video platform that helps agencies and growth teams start more conversations, book more meetings, and build predictable pipeline.',
    form: { title: 'See How Personalized Video Can Fill Your Pipeline', subtitle: 'Get a 2-minute custom video example and a plan for your business.', submitLabel: 'Send My Personalized Video', privacy: 'We’ll only use your info to send your video and relevant resources. No spam, ever.', fields: [field('name', 'Your Name'), field('email', 'Work Email', 'email'), field('company', 'Company Name'), field('goal', 'Monthly Lead Goal?', 'text', false)] },
    ctas: [{ label: 'Get Started Free', kind: 'form', value: '', style: 'primary' }, { label: 'Book a Strategy Call', kind: 'calendar', value: '', style: 'secondary' }],
  },
};
