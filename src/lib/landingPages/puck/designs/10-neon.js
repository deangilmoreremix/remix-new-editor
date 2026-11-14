/**
 * Puck template 10: "Neon KPI". Above the fold it follows the supplied design; the strip, lead table,
 * results and testimonials below are continued in the same family from existing card types and are
 * NOT from the supplied design. All names and figures are SAMPLE copy.
 */
const q = (id, text, name, role) => ({ type: 'QuoteCard', props: { id, columns: 1, heading: '', quotes: [{ text, name, role }] } });
export default {
  id: 'puck-neon',
  designClass: 'neon',
  name: 'Neon KPI',
  description: 'Dark navy neon landing page with a glowing video, demo form, live-style leads counter and gift card (sample content).',
  theme: { mode: 'dark', accent: '#19e6ee', highlight: '#a78bfa', bg: '#070c24', text: '#f1f5ff', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 16,
  puckData: {
    root: { props: { design: 'neon', accent: '#19e6ee', background: '#070c24', text: '#f1f5ff', surface: '#11173f' } },
    content: [
      { type: 'NavBar', props: { id: 'neon-nav', brand: 'SmartVideo AI', logo: '/landing-art/10/logo.webp', links: ['Product', 'Solutions', 'Pricing', 'Resources'].map((label) => ({ label, url: '' })), loginLabel: 'Log In', loginUrl: '', ctaLabel: 'Start Free Trial' } },
      { type: 'NeonHero', props: {
        id: 'neon-hero',
        eyebrow: 'Personalized Video Lead Generation',
        headline: 'Turn Every Prospect Into a Warm Lead With [[Personalized Video]]',
        subhead: 'Create, send, and track AI-personalized videos at scale. Build your email list, capture more leads, and grow revenue, all in one platform.',
        bullets: [{ text: 'AI-powered video personalization' }, { text: 'Built-in lead capture & list building' }, { text: 'Automated follow-ups & nurturing' }],
        chip: 'Hi {{firstname|there}}, this video is just for you!', photo: '/landing-art/10/presenter.webp',
        formTitle: 'Get Your Personalized Video & Grow Your Lead List',
        formFields: [{ key: 'name', label: 'Your First Name', type: 'text', required: true }, { key: 'email', label: 'Your Email Address', type: 'email', required: true }, { key: 'company', label: 'Company (Optional)', type: 'text', required: false }],
        submitLabel: 'Create My Personalized Video', privacy: '', orLabel: 'or', buttons: [{ label: 'Book a Live Walkthrough', url: 'mailto:hello@example.com' }],
        kpiTitle: 'Leads Captured (All Time)', kpiValue: '128,349', kpiBadge: '+37% (Last 30 days)',
        giftTitle: 'Join Our Insider List & Get a Free "Personalized Video Playbook"', giftPlaceholder: 'Enter your email', giftButton: 'Get the Free Playbook', giftCover: 'The Personalized Video Playbook',
      } },
      { type: 'Strip', props: { id: 'neon-strip', kind: 'benefits', title: '', items: [{ title: 'Personalized Video at Scale', text: '', value: '', icon: 'video' }, { title: 'Build & Grow Your List', text: '', value: '', icon: 'users' }, { title: 'Automated Lead Capture', text: '', value: '', icon: 'bolt' }, { title: 'Lead Tracking & Mini CRM', text: '', value: '', icon: 'layers' }, { title: 'Book More Sales Calls', text: '', value: '', icon: 'calendar' }] } },
      {
        type: 'Grid',
        props: {
          id: 'neon-grid', columns: 4,
          items: [
            { type: 'TableCard', props: { id: 'neon-table', columns: 2, title: '', windowTitle: 'Lead Tracker (Mini CRM)', windowSubtitle: 'SmartVideo AI', sidebar: ['Leads', 'Videos', 'Campaigns', 'Reports'].map((label) => ({ label })), kpis: [], headings: 'Lead, Company, Engagement, Status', rows: [{ name: 'Sarah Chen', col2: 'Acme Co.', col3: '100% watched', tag: 'Hot Lead' }, { name: 'James Miller', col2: 'BrightTech', col3: '87% watched', tag: 'Contacted' }, { name: 'Elena Rodriguez', col2: 'GrowthLabs', col3: '72% watched', tag: 'Nurturing' }] } },
            { type: 'StatsCard', props: { id: 'neon-stats', columns: 2, title: 'Real Results for Growth-Minded Businesses', items: [{ value: '+317%', label: 'Lead Conversion', icon: 'target' }, { value: '+4.2x', label: 'List Growth', icon: 'users' }, { value: '68%', label: 'More Booked Calls', icon: 'calendar' }, { value: '+289%', label: 'Pipeline Value', icon: 'chart' }] } },
            q('neon-q1', 'Our email list grew by 3x in 30 days and the personalized videos get way more replies than standard emails.', 'Melissa Grant', 'CEO, Grant Marketing'),
            q('neon-q2', 'Made it simple to create personalized outreach at scale. More leads, more calls, more real opportunities.', 'Ryan Carter', 'Founder, Carter Growth'),
            q('neon-q3', 'The built-in lead tracking and automation is a game-changer. Like a marketing assistant that never sleeps.', 'Priya Desai', 'CMO, Elevate Brands'),
            { type: 'ButtonCard', props: { id: 'neon-btn', columns: 1, eyebrow: 'Sample content', title: 'See it in action', text: 'Book a short live walkthrough.', buttons: [{ label: 'Book a Live Walkthrough', url: '', style: 'secondary' }] } },
          ],
        },
      },
      { type: 'Band', props: { id: 'neon-band', brand: '', tagline: '', title: 'Join 10,000+ marketers getting higher-quality leads with personalized video.', text: '', placeholder: 'Enter your email address', buttonLabel: 'Get Started Free', social: '' } },
      { type: 'Footer', props: { id: 'neon-footer', text: 'Sample content only · {{brand|SmartVideo AI}}', links: [] } },
    ],
    zones: {},
  },
};
