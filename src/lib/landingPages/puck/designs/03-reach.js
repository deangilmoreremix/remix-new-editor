const id = (n) => `reach-${n}`;

export default {
  id: 'puck-reach',
  name: 'Bold red outreach',
  description: 'Red wave hero with video and form, trust bar with rating laurels, playbook, benefits, results, funnel, testimonials and FAQ. Sample content only.',
  designClass: 'reach',
  theme: { mode: 'light', accent: '#dc2626', highlight: '#f59e0b', bg: '#ffffff', text: '#1a1414', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 12,
  puckData: {
    root: { props: { design: 'reach', accent: '#dc2626', background: '#ffffff', text: '#1a1414', surface: '#fff5f2' } },
    content: [
      { type: 'NavBar', props: { id: id('nav'), brand: 'SmartVideo AI', logo: '/landing-art/03/logo.webp', links: ['How It Works', 'Features', 'Results', 'Testimonials', 'Pricing', 'FAQ'].map((label) => ({ label, url: '' })), loginLabel: 'Book a Demo', loginUrl: 'https://example.com/demo', ctaLabel: 'Get Started Free' } },
      {
        type: 'Hero',
        props: {
          id: id('hero'),
          variant: 'copy-video-form',
          eyebrow: 'PERSONALIZED VIDEO OUTREACH PLATFORM',
          headline: 'Turn More Prospects Into Customers with [[Personalized Outreach]]',
          subhead: 'Create, send, and track personalized videos at scale to generate more leads, build real relationships, and close more deals, with less effort.',
          bullets: [{ text: 'Higher Response Rates' }, { text: 'More Qualified Leads' }, { text: 'More Meetings & Sales' }],
          buttons: [{ label: 'Book a Live Demo', url: 'https://example.com/demo', style: 'secondary' }],
          chip: 'A Personalized Video for You!',
          photo: '/landing-art/03/presenter.webp',
          showForm: 'yes',
          formTitle: 'Get More Leads with Personalized Videos',
          formSubtitle: 'See how VideoReach can help you generate, engage, and convert more prospects.',
          formFields: [
            { key: 'firstname', label: 'First Name *', type: 'text', required: true },
            { key: 'lastname', label: 'Last Name *', type: 'text', required: false },
            { key: 'email', label: 'Work Email *', type: 'email', required: true },
            { key: 'company', label: 'Company Name *', type: 'text', required: true },
            { key: 'size', label: 'Company Size *', type: 'text', required: false },
          ],
          submitLabel: 'Get My Personalized Demo',
          privacy: '',
        },
      },
      {
        type: 'ReachTrustBar',
        props: {
          id: id('trust'),
          title: 'Trusted by Growth-Focused Teams',
          logos: ['HubSpot', 'salesforce', 'pipedrive', 'ZOHO', 'shopify', 'ClickUp'].map((name) => ({ name })),
          badges: [{ value: '4.9/5', label: 'Customer Rating' }, { value: '10,000+', label: 'Videos Created' }, { value: '500+', label: 'Growing Businesses' }],
        },
      },
      {
        type: 'Grid',
        props: {
          id: id('grid1'),
          columns: 3,
          items: [
            { type: 'LeadMagnetCard', props: { id: id('magnet'), columns: 1, tag: 'FREE LEAD MAGNET', title: 'Get the Personalized Video Playbook', cover: 'The Personalized Video Playbook', text: 'A step-by-step guide to generating more leads and meetings with video outreach.', placeholder: 'Enter your email address', buttonLabel: 'Get the Free Guide' } },
            { type: 'FeaturesCard', props: { id: id('feats'), columns: 1, title: 'Why VideoReach Drives More Leads', items: [
              { icon: 'video', title: 'Create Personalized Videos', text: 'Use your name, company, and custom touches.' },
              { icon: 'users', title: 'Build Your Lead List', text: 'Capture and organize high-intent leads.' },
              { icon: 'bolt', title: 'Automate Outreach', text: 'Send at scale without losing the personal touch.' },
              { icon: 'chart', title: 'Track & Convert', text: 'See opens, views, and replies to turn interest into meetings.' },
            ] } },
            { type: 'StatsCard', props: { id: id('stats'), columns: 1, title: 'Real Results from Our Customers', items: [{ icon: 'arrow', value: '3.4x', label: 'Higher Response Rate' }, { icon: 'users', value: '57%', label: 'More Qualified Leads' }, { icon: 'target', value: '2.8x', label: 'More Meetings Booked' }] } },
          ],
        },
      },
      {
        type: 'Grid',
        props: {
          id: id('grid2'),
          columns: 3,
          items: [
            { type: 'StepsCard', props: { id: id('funnel'), columns: 1, title: '', layout: 'list', items: [
              { icon: 'users', title: 'Build Your List', text: 'Attract leads with valuable content & offers.' },
              { icon: 'play', title: 'Personalize & Reach Out', text: 'Send one-to-one videos that get opened & watched.' },
              { icon: 'calendar', title: 'Book Meetings', text: 'Turn interest into real conversations.' },
              { icon: 'target', title: 'Convert & Grow', text: 'Close more deals and build long-term customers.' },
            ] } },
            { type: 'QuoteCard', props: { id: id('quotes'), columns: 1, heading: 'What Our Customers Are Saying', quotes: [
              { text: 'Our response rate jumped from 8% to 32% after adding personalized video outreach with VideoReach!', name: 'Jessica R.', role: 'Head of Marketing, SaaSCo' },
              { text: 'It’s like 1:1 outreach at scale. We’ve booked 3.4x more meetings and our pipeline is fuller than ever.', name: 'Mark T.', role: 'Founder, GrowthLabs' },
              { text: 'Super easy to use, and the results are real. More replies, more conversations, and more closed deals.', name: 'Emily K.', role: 'Sales Director, CloudEdge' },
            ] } },
            { type: 'FaqCard', props: { id: id('faq'), columns: 1, title: 'Frequently Asked Questions', items: [
              { q: 'What is VideoReach?', a: 'A way to send one-to-one personalized videos and capture the leads they generate.' },
              { q: 'How does personalized video outreach work?', a: 'Record once, then each contact sees their own name and company on their own link.' },
              { q: 'Can I build a lead list inside the platform?', a: 'Yes. Every form submission is saved as a lead.' },
              { q: 'Do I need video editing experience?', a: 'No.' },
              { q: 'Is there a free trial?', a: 'Add your answer here.' },
            ] } },
          ],
        },
      },
      { type: 'Band', props: { id: id('band'), brand: '', tagline: '', title: 'Get Lead-Gen Tips, Templates & Growth Strategies Straight to Your Inbox', text: 'Proven outreach strategies · Done-for-you templates · Exclusive growth insights', placeholder: 'Enter your email address', buttonLabel: 'Send Me the Best Tips', social: '' } },
      { type: 'Footer', props: { id: id('footer'), text: 'Sample content for demonstration only.', links: [] } },
    ],
    zones: {},
  },
};
