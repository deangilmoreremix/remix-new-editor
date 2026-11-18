/** 01 Neon lead-gen: dark glass look, video + headline + demo form, benefit strip, bento row, testimonials, sign-up band. All names, figures and quotes are SAMPLE copy. */
export default {
  id: 'puck-leadiq',
  name: 'Neon lead-gen',
  description: 'Dark teal and violet glass: video, headline and demo form, a playbook card, mini CRM and results, then testimonials and a sign-up band (sample content).',
  designClass: 'leadiq',
  theme: { mode: 'dark', accent: '#19d9c6', highlight: '#7dd3fc', bg: '#060a1c', text: '#f1f5ff', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 16,
  puckData: {
    root: { props: { design: 'leadiq', accent: '#19d9c6', background: '#060a1c', text: '#f1f5ff', surface: '' } },
    content: [
      { type: 'NavBar', props: { id: 'lq-nav', brand: 'SmartVideo AI', logo: '/landing-art/01/logo.webp', links: [{ label: 'Product', url: '' }, { label: 'Solutions', url: '' }, { label: 'Pricing', url: '' }, { label: 'Resources', url: '' }, { label: 'Customers', url: '' }], loginLabel: 'Log In', loginUrl: 'https://example.com/login', ctaLabel: 'Start Free Trial' } },
      {
        type: 'Hero',
        props: {
          id: 'lq-hero', variant: 'video-copy-form', eyebrow: 'Personalized Video Lead Generation Platform',
          headline: "{{firstname|Hi}}, here's a smarter way to [[grow your business.]]",
          subhead: 'Create personalized videos at scale, capture more qualified leads, and turn interest into real conversations—automatically.',
          bullets: [{ text: 'Personalized videos that get higher responses' }, { text: 'Built-in lead capture and list growth tools' }, { text: 'Track, nurture, and close leads in one platform' }],
          buttons: [{ label: 'Book a 15-Min Strategy Call', url: '#lead', style: 'secondary' }],
          chip: 'Personal Video for {{firstname|you}}', photo: '/landing-art/01/presenter.webp', showForm: 'yes',
          formTitle: 'Get Your Personalized Demo', formSubtitle: 'See how VideoLeadIQ can help you generate more leads and grow faster.',
          formFields: [{ key: 'name', label: 'Your Name', type: 'text', required: true }, { key: 'email', label: 'Your Email', type: 'email', required: true }, { key: 'company', label: 'Your Company', type: 'text', required: false }],
          submitLabel: 'Get My Personalized Demo', privacy: '',
        },
      },
      {
        type: 'Strip',
        props: {
          id: 'lq-strip', kind: 'benefits', title: '',
          items: [
            { title: 'Personalized Video at Scale', text: '', value: '', icon: 'video' },
            { title: 'Build & Grow Your List', text: '', value: '', icon: 'users' },
            { title: 'Automated Lead Capture', text: '', value: '', icon: 'bolt' },
            { title: 'Lead Tracking & Mini CRM', text: '', value: '', icon: 'layers' },
            { title: 'Book More Sales Calls', text: '', value: '', icon: 'calendar' },
            { title: 'Higher Conversions & Revenue', text: '', value: '', icon: 'chart' },
          ],
        },
      },
      {
        type: 'Grid',
        props: {
          id: 'lq-grid', columns: 3,
          items: [
            { type: 'LeadMagnetCard', props: { id: 'lq-magnet', columns: 1, tag: 'FREE RESOURCE', title: 'Get the Personalized Video Playbook', cover: 'The Personalized Video Playbook', text: 'Join our email list and get our proven framework, templates, and scripts to generate more leads with video.', placeholder: 'Enter your email', buttonLabel: 'Send Me the Playbook' } },
            {
              type: 'TableCard',
              props: {
                id: 'lq-crm', columns: 1, title: 'Lead Tracker (Mini CRM)', windowTitle: 'VideoLeadIQ™', windowSubtitle: 'Lead Tracker (Mini CRM)',
                sidebar: [{ label: 'Leads' }, { label: 'Videos' }, { label: 'Campaigns' }, { label: 'Automations' }, { label: 'Reports' }], kpis: [],
                headings: 'Lead, Company, Video Engagement, Status',
                rows: [
                  { name: 'Sarah Chen', col2: 'Acme Co.', col3: '100% watched', tag: 'Hot Lead' },
                  { name: 'James Miller', col2: 'BrightTech', col3: '87% watched', tag: 'Contacted' },
                  { name: 'Elena Rodriguez', col2: 'GrowthLabs', col3: '72% watched', tag: 'Nurturing' },
                  { name: 'David Park', col2: 'NextWave', col3: '56% watched', tag: 'New Lead' },
                ],
              },
            },
            { type: 'StatsCard', props: { id: 'lq-stats', columns: 1, title: 'Real Results for Growth-Minded Businesses', items: [{ value: '+317%', label: 'Lead Conversion', icon: 'target' }, { value: '+4.2x', label: 'List Growth', icon: 'users' }, { value: '68%', label: 'More Booked Calls', icon: 'calendar' }, { value: '+289%', label: 'Pipeline Value', icon: 'chart' }] } },
          ],
        },
      },
      {
        type: 'LeadiqTestimonials',
        props: {
          id: 'lq-voices', eyebrow: 'CUSTOMER LOVE', title: 'What Our Users Are Saying',
          quotes: [
            { photo: '/landing-art/01/q1.webp', text: 'Our email list grew by 3x in 30 days and the personalized videos get way more replies than standard emails.', name: 'Melissa Grant', role: 'CEO, Grant Marketing', stars: 5 },
            { photo: '/landing-art/01/q2.webp', text: 'VideoLeadIQ made it simple to create personalized outreach at scale. More leads, more calls, more real opportunities.', name: 'Ryan Carter', role: 'Founder, Carter Growth', stars: 5 },
            { photo: '/landing-art/01/q3.webp', text: 'The built-in lead tracking and automation is a game-changer. It’s like having a marketing assistant that never sleeps.', name: 'Priya Desai', role: 'CMO, Elevate Brands', stars: 5 },
          ],
        },
      },
      { type: 'LeadiqFooterBand', props: { id: 'lq-band', brand: 'VideoLeadIQ™', tagline: 'Personalized Video. More Leads. Real Growth.', title: 'Join 10,000+ marketers and business owners getting higher-quality leads with personalized video.', placeholder: 'Enter your email address', buttonLabel: 'Get Started Free', followLabel: 'Follow Us', socials: [{ network: 'linkedin', url: 'https://example.com/linkedin', label: 'LinkedIn' }, { network: 'youtube', url: 'https://example.com/youtube', label: 'YouTube' }, { network: 'x', url: 'https://example.com/x', label: 'X' }, { network: 'instagram', url: 'https://example.com/instagram', label: 'Instagram' }] } },
    ],
    zones: {},
  },
};
