/** Luxury concierge: cream and gold serif look. All names, figures and quotes are SAMPLE copy. */
const id = (n) => `${n}-persona`;
export default {
  id: 'puck-persona',
  name: 'Luxury concierge',
  description: 'Cream and gold serif page with a large video, private-consultation form, wordmarks, portrait testimonials and a 4-step onboarding (sample content).',
  designClass: 'persona',
  theme: { mode: 'light', accent: '#8a6a1f', highlight: '#8a6a1f', bg: '#f7f0e6', text: '#2a2118', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 6,
  puckData: {
    root: { props: { design: 'persona', accent: '#8a6a1f', background: '#f7f0e6', text: '#2a2118', surface: '#fcf8f2' } },
    content: [
      { type: 'NavBar', props: { id: id('nav'), brand: 'SmartVideo AI', logo: '/landing-art/04/logo.webp', links: [{ label: 'Platform', url: '' }, { label: 'Solutions', url: '' }, { label: 'How It Works', url: '' }, { label: 'Success Stories', url: '' }, { label: 'Resources', url: '' }], loginLabel: '', loginUrl: '', ctaLabel: 'Book a Private Strategy Call' } },
      { type: 'PersonaHero', props: { id: id('hero'),
        eyebrow: 'PERSONALIZED VIDEO LEAD GENERATION',
        headline: 'Turn Personal Connection into Predictable Growth',
        subhead: 'Create, deliver, and scale personalized videos that captivate, qualify, and convert your ideal prospects — all on one elegant platform.',
        bullets: [{ text: 'Higher Engagement' }, { text: 'More Qualified Leads' }, { text: 'Greater Revenue' }],
        buttonLabel: 'Start Your Personalized Video Experience', buttonUrl: '#lead',
        chipText: 'A Personalized Message for You,', chipScript: '{{firstname|Jordan}}',
        photo: '/landing-art/04/presenter.webp',
        formTitle: 'Request a Private Consultation', formSubtitle: 'Let’s explore how personalized video can drive results for your business.',
        formFields: [{ key: 'name', label: 'Full Name', type: 'text', required: true }, { key: 'email', label: 'Business Email', type: 'email', required: true }, { key: 'company', label: 'Company', type: 'text', required: false }, { key: 'goals', label: 'Tell us about your goals', type: 'select', options: 'Generate more leads, Nurture existing clients, Launch a new offer, Something else', required: false }],
        submitLabel: 'Request My Consultation', privacy: 'A concierge will be in touch within 1 business day.' } },
      { type: 'PersonaLogos', props: { id: id('strip'), title: 'TRUSTED BY LEADING BRANDS', items: [{ name: 'Forbes', subline: '' }, { name: 'LUXE REALTY', subline: 'GROUP' }, { name: 'VANTAGE', subline: 'CAPITAL' }, { name: 'Asteria', subline: 'WELLNESS' }, { name: 'CARRINGTON', subline: 'ADVISORS' }, { name: 'The Haven', subline: 'COLLECTION™' }] } },
      {
        type: 'PersonaTestimonials',
        props: {
          id: id('quotes'),
          eyebrow: 'RESULTS OUR CLIENTS LOVE',
          title: 'Real Connections. Real Growth.',
          quotes: [
            { photo: '/landing-art/04/avatar1.webp', text: 'The personalized videos helped us 3× our qualified pipeline in just 60 days.', name: 'Michael Reeves', role: 'CEO, Vantage Capital' },
            { photo: '/landing-art/04/avatar2.webp', text: 'It feels like a white-glove experience for our prospects — and the results are exceptional.', name: 'Elena Carrington', role: 'Founder, Carrington Advisors' },
            { photo: '/landing-art/04/avatar3.webp', text: 'A game-changer for our outreach and lead generation. Personal, scalable, and proven.', name: 'James Park', role: 'Managing Partner, Luxe Realty Group' },
          ],
        },
      },
      {
        type: 'PersonaSteps',
        props: {
          id: id('steps'),
          eyebrow: 'THE CONCIERGE ONBOARDING EXPERIENCE',
          title: 'From Vision to Leads — White-Glove, End to End.',
          steps: [
            { icon: '/landing-art/04/step1.webp', title: 'Discover', text: 'A strategy consultation to align on your goals.' },
            { icon: '/landing-art/04/step2.webp', title: 'Personalize', text: 'We craft your branded, personalized video experience.' },
            { icon: '/landing-art/04/step3.webp', title: 'Launch', text: 'Go live with a guided, concierge rollout.' },
            { icon: '/landing-art/04/step4.webp', title: 'Grow', text: 'Capture, nurture, and convert more of the right leads.' },
          ],
        },
      },
      {
        type: 'PersonaResources',
        props: {
          id: id('cards'),
          cards: [
            { image: '/landing-art/04/book.webp', eyebrow: 'FEATURED RESOURCE', title: 'The Personalized Video Playbook', text: 'A strategic guide to higher engagement, more qualified leads, and lasting client relationships.', buttonLabel: 'Download the Free Playbook', buttonUrl: '#lead', action: 'signup', icon: 'download', placeholder: 'Your email address' },
            { image: '/landing-art/04/room.webp', eyebrow: 'HAVE A QUESTION?', title: 'Let’s Connect', text: 'Our team is here to help you explore the right personalized video strategy for your business.', buttonLabel: 'Contact Our Team', buttonUrl: 'mailto:hello@example.com', action: 'link', icon: 'mail', placeholder: '' },
          ],
        },
      },
      { type: 'Band', props: { id: id('band'), brand: 'PersonaVideo™', tagline: '', title: 'Be the First to See What’s Next', text: 'Get exclusive insights, product updates, and lead-generation strategies delivered to your inbox.', placeholder: 'Your email address', buttonLabel: 'Sign Up', social: 'Follow us on LinkedIn, Instagram, YouTube and X' } },
    ],
    zones: {},
  },
};
