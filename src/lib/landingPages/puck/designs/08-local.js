/** Puck design 08: "Local business". Warm cream and orange, owner-photo hero, industry tiles, four cards, green newsletter band. SAMPLE copy only. */
const field = (key, label, type = 'text', required = true) => ({ key, label: `${label} *`, type, required });

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
          chip: 'Hi Neighbor!', photo: '/landing-art/08/presenter.webp', showForm: 'yes', formTitle: 'Get a Personalized Demo', formSubtitle: 'See how personalized video can bring more leads and customers to your business.',
          formFields: [field('name', 'Your Name'), field('email', 'Email Address', 'email'), field('phone', 'Phone Number', 'tel'), field('company', 'Business Name')],
          submitLabel: 'Get My Demo →', privacy: 'or Schedule a Free Consultation',
        },
      },
      { type: 'LocalIndustries', props: { id: 'local-industries', title: 'Built for\nLocal & [[Service]]\nBusinesses', text: 'A simple, powerful way to connect with more people in your area.', tiles: ['Home Services', 'Pet Care', 'Health & Wellness', 'Salons & Spas', 'Restaurants & Cafés', 'Local Retail', 'Auto Services'].map((label) => ({ label })), more: 'And many more!' } },
      {
        type: 'Grid',
        props: {
          id: 'local-grid', columns: 4,
          items: [
            { type: 'ChecklistCard', props: { id: 'local-checks', columns: 1, title: 'Why Local Businesses Love It', text: '', items: ['Get more qualified leads from your community', 'Build and grow your customer list', 'Stand out with personal, human video messages', 'Automatically follow up and turn leads into bookings', 'Easy to set up and manage — no tech headaches'].map((label) => ({ label, value: '' })) } },
            { type: 'LocalFlowCard', props: { id: 'local-flow', columns: 1, title: 'Automatic Follow-Up\nThat Keeps Leads Moving', text: 'Turn new leads into paying customers with simple, automated video follow-ups.', steps: ['Collect Leads', 'Send a Personalized Video', 'Follow Up Automatically', 'Get Bookings & More Customers'].map((label) => ({ label })) } },
            { type: 'QuoteCard', props: { id: 'local-quotes', columns: 1, heading: 'What Local Businesses Are Saying', quotes: [{ text: 'The personalized videos helped us get 40% more leads in just one month! It feels personal, local, and our customers love it.', name: 'Michelle T.', role: 'Riverside Home Services' }, { text: 'Super easy to use and it actually brings in real leads from our area. A game-changer for our small business.', name: 'David R.', role: 'Maple Grove Auto Care' }] } },
            { type: 'LocalMapCard', props: { id: 'local-map', columns: 1, title: 'Serving Your Local Community', text: 'Proudly serving Riverside, Maple Grove, Oak Hill, Pinecrest, Lakeside, and nearby areas!' } },
          ],
        },
      },
      { type: 'Band', props: { id: 'local-band', brand: '', tagline: 'Request a Demo or Schedule a Consultation →', title: 'Get Local Business Tips & Lead-Generation Ideas', text: 'Join our list for practical video marketing tips, local business growth strategies, and product updates.', placeholder: 'Your Email', buttonLabel: 'Sign Me Up →', social: 'Ready to grow your business with personalized video?' } },
      { type: 'Footer', props: { id: 'local-footer', text: 'Sample content for illustration only.', links: [] } },
    ],
    zones: {},
  },
};
