const ACCENT = '#5b45e6';
const f = (key, label, type = 'text', required = true) => ({ key, label, type, required });
const ic = (title, icon, text) => ({ title, icon, text, value: '' });

export default {
  id: 'puck-lead',
  name: 'Clean SaaS',
  description: 'Light lavender SaaS page: headline, video and form across the top, a logo strip, then six small cards (all sample content).',
  designClass: 'lead',
  theme: { mode: 'light', accent: ACCENT, highlight: '#6d4aff', bg: '#fbfaff', text: '#14143a', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 16,
  puckData: {
    root: { props: { design: 'lead', accent: ACCENT, background: '#fbfaff', text: '#14143a', surface: '#ffffff' } },
    content: [
      { type: 'NavBar', props: { id: 'lead-nav', brand: 'SmartVideo AI', logo: '/landing-art/02/logo.webp', links: [{ label: 'Product', url: '' }, { label: 'Solutions', url: '' }, { label: 'Resources', url: '' }, { label: 'Pricing', url: '' }], loginLabel: 'Log In', loginUrl: '', ctaLabel: 'Book a Demo' } },
      {
        type: 'Hero',
        props: {
          id: 'lead-hero',
          variant: 'copy-video-form',
          eyebrow: 'Personalized Video Lead Generation',
          headline: 'Turn Personalized Videos Into [[Qualified Leads]]',
          subhead: 'Create, send, and track personalized videos at scale to capture more leads, build stronger relationships, and grow your pipeline.',
          bullets: [{ text: 'Personalize at scale' }, { text: 'Capture & segment leads' }, { text: 'Follow up with higher conversions' }],
          buttons: [],
          chip: 'Hi {{firstname|Alex}}! 👋',
          photo: '/landing-art/02/presenter.webp',
          showForm: 'yes',
          formTitle: 'Get Your Personalized Video Strategy',
          formSubtitle: 'See how personalized video can drive more leads for your business.',
          formFields: [f('name', 'Your Name'), f('email', 'Work Email', 'email'), f('company', 'Company', 'text', false)],
          submitLabel: 'Get My Personalized Demo',
          privacy: '',
        },
      },
      { type: 'Strip', props: { id: 'lead-strip', kind: 'logos', title: 'Trusted by growth-focused teams', items: ['Notionly', 'Cloudway', 'BrightPath', 'ScaleCRM', 'Nexora'].map((t) => ({ title: t, text: '', value: '', icon: '' })) } },
      { type: 'TextBlock', props: { id: 'lead-heading', eyebrow: '', title: 'A Complete List-Building Platform for [[Video-Led Growth]]', text: 'Capture more leads, grow high-quality lists, and turn interest into pipeline, all with personalized video.', align: 'center' } },
      {
        type: 'Grid',
        props: {
          id: 'lead-grid',
          columns: 6,
          items: [
            { type: 'LeadMagnetCard', props: { id: 'lead-magnet', columns: 1, tag: '', title: 'Downloadable Guide Signup', cover: 'The Personalized Video Playbook', text: 'Grow your list with high-value resources.', placeholder: 'Your Email', buttonLabel: 'Get the Free Guide' } },
            { type: 'ChecklistCard', props: { id: 'lead-segments', columns: 1, title: 'Contact Segmentation', text: 'Organize and target leads with smart segments.', items: [{ label: 'Marketing Pros', value: '1,248' }, { label: 'Sales Teams', value: '842' }, { label: 'Enterprise', value: '309' }, { label: 'Partners', value: '176' }] } },
            { type: 'QuoteCard', props: { id: 'lead-quote', columns: 1, heading: 'What Our Customers Say', quotes: [{ text: 'Personalized video has completely changed our lead generation. We are seeing higher engagement and 3× more qualified leads.', name: 'Jordan Miller', role: 'Head of Growth, BrightPath' }] } },
            { type: 'FeaturesCard', props: { id: 'lead-features', columns: 1, title: 'Key Features', items: [ic('Personalized video at scale', 'video', 'Create 1:1 videos in minutes.'), ic('Lead capture & list-building', 'filter', 'Turn views into qualified leads.'), ic('Automated follow-ups', 'bolt', 'Keep leads engaged and moving.'), ic('Performance insights', 'chart', 'Track views, conversions, and ROI.')] } },
            { type: 'ScheduleCard', props: { id: 'lead-schedule', columns: 1, title: 'Book a Demo', text: 'Pick a time that works for you.', month: 'Mar 2025', days: '9,10,11,*12,13,14,15', time: '10:00 AM (30 min)', buttonLabel: 'Confirm Demo' } },
            {
              type: 'TableCard',
              props: {
                id: 'lead-crm', columns: 1, title: 'Leads Overview (CRM)', windowTitle: '', windowSubtitle: '', sidebar: [],
                kpis: [{ value: '2,847', label: 'Total Leads' }, { value: '+42%', label: 'vs. last month' }, { value: '18.6%', label: 'Conversion' }],
                headings: 'Recent Leads, Status',
                rows: [{ name: 'Alex Carter', col2: 'Acme Co.', col3: '', tag: 'Qualified' }, { name: 'Taylor Reed', col2: 'NovaTech', col3: '', tag: 'In Progress' }, { name: 'Morgan Lee', col2: 'BrightPath', col3: '', tag: 'New' }],
              },
            },
          ],
        },
      },
      { type: 'Band', props: { id: 'lead-band', brand: '', tagline: '', title: 'Get list-building tips and product updates', text: 'One short email, now and then.', placeholder: 'Enter your email', buttonLabel: 'Subscribe', social: '' } },
      { type: 'Footer', props: { id: 'lead-footer', text: 'Sample content for illustration. Sent by {{sender|us}}', links: [] } },
    ],
    zones: {},
  },
};
