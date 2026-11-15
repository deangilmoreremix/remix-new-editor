/** Puck design 08: "Local business". Warm cream and orange, owner-photo hero, industry tiles, four cards, green newsletter band. SAMPLE copy only. */
const field = (key, label, type = 'text', required = true) => ({ key, label: `${label} *`, type, required });

const TILES = [['Home Services', 'home', 't1'], ['Pet Care', 'leaf', 't2'], ['Health & Wellness', 'heart', 't3'], ['Salons & Spas', 'sparkles', 't4'], ['Restaurants & Cafés', 'cutlery', 't5'], ['Local Retail', 'tag', 't6'], ['Auto Services', 'car', 't7']];
const STEPS = [['Collect Leads', 'filter', 's1'], ['Send a Personalized Video', 'play', 's2'], ['Follow Up Automatically', 'mail', 's3'], ['Get Bookings & More Customers', 'calendar', 's4']];

export default {
  id: 'puck-local',
  designClass: 'local',
  name: 'Local business',
  description: 'Warm cream and orange page with an owner-photo hero, industry tiles, four cards and a green newsletter band (sample content).',
  theme: { mode: 'light', accent: '#d1560f', highlight: '#f7b500', bg: '#fdf5e8', text: '#1f3326', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 16,
  puckData: {
    root: { props: { design: 'local', accent: '#d1560f', background: '#fdf5e8', text: '#1f3326', surface: '#ffffff' } },
    content: [
      { type: 'NavBar', props: { id: 'local-nav', brand: 'SmartVideo AI', logo: '', links: [{ label: 'How It Works', url: '' }, { label: 'Features', url: '' }, { label: 'For Local Businesses', url: '' }, { label: 'Pricing', url: '' }, { label: 'Reviews', url: '' }, { label: '(855) 742-3684', url: 'tel:+18557423684' }], loginLabel: 'Request Demo', loginUrl: '', ctaLabel: 'Schedule a Consultation' } },
      {
        type: 'Hero',
        props: {
          id: 'local-hero', variant: 'copy-video-form', eyebrow: 'Personalized Videos that', headline: 'Get More Leads\nfor Your [[Local Business]]',
          subhead: 'Send friendly, personalized video messages that attract new customers, collect leads, build your list, and turn interest into real business — in your community.',
          bullets: [{ text: 'Personalized Videos' }, { text: 'Capture Leads' }, { text: 'Automated Follow-Up' }, { text: 'More Customers' }], buttons: [],
          chip: 'Hi\nNeighbor!', photo: '/landing-art/08/presenter.webp', showForm: 'yes', formTitle: 'Get a Personalized Demo', formSubtitle: 'See how personalized video can bring more leads and customers to your business.',
          formFields: [field('name', 'Your Name'), field('email', 'Email Address', 'email'), field('phone', 'Phone Number', 'tel'), field('company', 'Business Name')],
          submitLabel: 'Get My Demo →', privacy: 'or Schedule a Free Consultation',
        },
      },
      { type: 'LocalVideoNote', props: { id: 'local-note', text: 'See a personalized\nvideo in action!' } },
      { type: 'LocalIndustries', props: { id: 'local-industries', title: 'Built for\nLocal & [[Service]]\nBusinesses', text: 'A simple, powerful way to connect with more people in your area.', tiles: TILES.map(([label, icon, k]) => ({ label, icon, image: `/landing-art/08/${k}.webp` })), more: 'And many more!' } },
      {
        type: 'Grid',
        props: {
          id: 'local-grid', columns: 4,
          items: [
            { type: 'ChecklistCard', props: { id: 'local-checks', columns: 1, title: 'Why Local Businesses Love It', text: '', items: ['Get more qualified leads from your community', 'Build and grow your customer list', 'Stand out with personal, human video messages', 'Automatically follow up and turn leads into bookings', 'Easy to set up and manage — no tech headaches'].map((label) => ({ label, value: '' })) } },
            { type: 'LocalFlowCard', props: { id: 'local-flow', columns: 1, title: 'Automatic Follow-Up\nThat Keeps Leads Moving', text: 'Turn new leads into paying customers with simple, automated video follow-ups.', steps: STEPS.map(([label, icon, k]) => ({ label, icon, image: `/landing-art/08/${k}.webp` })) } },
            { type: 'QuoteCard', props: { id: 'local-quotes', columns: 1, heading: 'What Local Businesses Are Saying', quotes: [{ text: 'The personalized videos helped us get 40% more leads in just one month! It feels personal, local, and our customers love it.', name: 'Michelle T.', role: 'Riverside Home Services' }, { text: 'Super easy to use and it actually brings in real leads from our area. A game-changer for our small business.', name: 'David R.', role: 'Maple Grove Auto Care' }] } },
            { type: 'LocalMapCard', props: { id: 'local-map', columns: 1, title: 'Serving Your Local Community', text: 'Proudly serving Riverside, Maple Grove, Oak Hill, Pinecrest, Lakeside, and nearby areas!' } },
          ],
        },
      },
      { type: 'LocalNewsletter', props: { id: 'local-band', title: 'Get Local Business Tips & Lead-Generation Ideas', text: 'Join our list for practical video marketing tips, local business growth strategies, and product updates.', nameLabel: 'Your Name', emailLabel: 'Your Email', buttonLabel: 'Sign Me Up', social: 'Ready to grow your business\nwith personalized video?', links: [{ label: 'Request a Demo', url: '#lead' }, { label: 'Schedule a Consultation', url: '#lead' }] } },
      { type: 'Footer', props: { id: 'local-footer', text: 'Sample content for illustration only.', links: [] } },
    ],
    zones: {},
  },
};
