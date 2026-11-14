/* Design 05: playful sunshine. Sample copy only; every name, figure and quote below is made up for the demo. */
const art = (f) => `/landing-art/05/${f}.webp`;

const nav = {
  type: 'NavBar',
  props: {
    id: 'spark-nav',
    brand: 'SmartVideo AI',
    logo: art('logo'),
    links: ['Features', 'How It Works', 'Pricing', 'Customers', 'Resources'].map((label) => ({ label, url: '' })),
    loginLabel: 'Log In',
    loginUrl: '',
    ctaLabel: 'Schedule a Demo',
  },
};

const hero = {
  type: 'Hero',
  props: {
    id: 'spark-hero',
    variant: 'copy-video-form',
    eyebrow: '',
    headline: 'Turn Prospects into Fans with Personalized [[Videos!]]',
    subhead: 'Create and send custom videos at scale to attract qualified leads, build real connections, and grow your business faster.',
    bullets: [{ text: 'No credit card' }, { text: 'Personalized for your business' }],
    buttons: [{ label: 'Schedule a Demo', url: 'https://example.com/demo', style: 'secondary' }],
    chip: 'Personalized for you, {{firstname|Alex}}!',
    photo: art('presenter'),
    showForm: 'yes',
    formTitle: 'Get Your Own Personalized Video!',
    formSubtitle: '',
    formFields: [
      { key: 'name', label: 'Your Name', type: 'text', required: true },
      { key: 'email', label: 'Your Email', type: 'email', required: true },
      { key: 'business', label: 'Your Business Type', type: 'text', required: false },
    ],
    submitLabel: 'Create My Personalized Video',
    privacy: '',
  },
};

const strip = {
  type: 'Strip',
  props: {
    id: 'spark-strip',
    kind: 'benefits',
    title: '',
    items: [
      { title: 'Personalize at Scale', text: 'One-to-one videos in minutes', value: '', icon: '' },
      { title: 'Generate More Leads', text: 'Turn views into a growing list', value: '', icon: '' },
      { title: 'Boost Engagement', text: 'Get higher replies & conversions', value: '', icon: '' },
      { title: 'Grow Your Business', text: 'More leads, more meetings, more sales', value: '', icon: '' },
    ],
  },
};

const grid = {
  type: 'Grid',
  props: {
    id: 'spark-grid',
    columns: 4,
    items: [
      { type: 'LeadMagnetCard', props: { id: 'spark-news', columns: 2, tag: 'FREE:', title: 'Join Our Growth Newsletter', cover: 'The Personalized Video Playbook (PDF)', text: 'Weekly video marketing tips, real examples, and lead-gen playbooks.', placeholder: 'Enter your email', buttonLabel: 'Get the Free Playbook' } },
      {
        type: 'StepsCard',
        props: {
          id: 'spark-steps', columns: 2, title: 'Get Started in 3 Simple Steps', layout: 'row',
          items: [
            { title: 'Connect & Customize', text: 'Add your brand, message, and a few personal touches.', icon: '' },
            { title: 'Import Your List', text: 'Add leads or connect your favorite tools (CRM, forms, etc.).', icon: '' },
            { title: 'Send & Grow', text: 'Deliver personalized videos and watch your leads (and list!) grow.', icon: '' },
          ],
        },
      },
      {
        type: 'TableCard',
        props: {
          id: 'spark-leads', columns: 2, title: 'Your Leads, All in One Place', windowTitle: '', windowSubtitle: '', sidebar: [], kpis: [], headings: '',
          rows: [
            { name: 'Alex M.', col2: 'Marketing Agency', col3: '', tag: 'Viewed' },
            { name: 'Jamie R.', col2: 'Real Estate', col3: '', tag: 'Clicked' },
            { name: 'Taylor K.', col2: 'SaaS Startup', col3: '', tag: 'Replied' },
          ],
        },
      },
      {
        type: 'QuoteCard',
        props: {
          id: 'spark-quotes', columns: 2, heading: 'Loved by Growing Businesses',
          quotes: [
            { text: 'Our lead list grew 3× in just one month!', name: 'Maya L.', role: 'Marketing Agency' },
            { text: 'Personalized videos feel so human — our reply rate is 48%!', name: 'Carlos P.', role: 'SaaS Founder' },
            { text: 'Super easy to set up, and it actually drives qualified leads.', name: 'Nina C.', role: 'Real Estate Group' },
          ],
        },
      },
      {
        type: 'FeaturesCard',
        props: {
          id: 'spark-feats', columns: 2, title: 'Why Businesses Love VideoSpark',
          items: ['Higher Conversions', 'Bigger, Healthier Lists', 'Stronger Relationships', 'Long-Term Growth'].map((title) => ({ icon: '', title, text: '' })),
        },
      },
    ],
  },
};

const band = {
  type: 'Band',
  props: { id: 'spark-band', brand: '', tagline: '', title: 'Start Growing Your Lead List Today!', text: '', placeholder: 'Enter your email', buttonLabel: 'Get Started Free', social: '' },
};

export default {
  id: 'puck-spark',
  name: 'Playful sunshine',
  description: 'Yellow, teal and coral with mascots, chunky rounded cards, a newsletter, three colourful steps, a leads list and testimonials (sample content).',
  designClass: 'spark',
  theme: { mode: 'light', accent: '#d63d44', highlight: '#1d4ed8', bg: '#fffdf3', text: '#14143a', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 22,
  puckData: { root: { props: { design: 'spark', accent: '#d63d44', background: '#fffdf3', text: '#14143a', surface: '#ffffff' } }, content: [nav, hero, strip, grid, band], zones: {} },
};
