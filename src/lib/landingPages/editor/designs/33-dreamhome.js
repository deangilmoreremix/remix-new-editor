/** Dream home hero page: sunny house photo, headline, video + form cards, icon strip, testimonials and a laptop CTA band. All names and quotes are SAMPLE copy. */
export default {
  id: 'editable-dreamhome',
  name: 'Dream home hero page',
  description: 'A bright real-estate hero over a sunny house photo: headline, video card and form card, an icon feature strip, testimonials and a dark-blue CTA band with a laptop (sample content).',
  designClass: 'dreamhome',
  theme: { mode: 'light', accent: '#0b5cff', highlight: '#7c3aed', bg: '#ffffff', text: '#0f1c4d', font: 'system' },
  layout: 'editable',
  editable: true,
  radius: 10,
  editorData: {
    root: { props: { design: 'dreamhome', accent: '#0b5cff', background: '#ffffff', text: '#0f1c4d', surface: '' } },
    content: [
      { type: 'NavBar', props: { id: 'dh-nav', brand: 'SmartVideo AI', logo: '/landing-art/dreamhome/logo.webp', links: [{ label: 'Features', url: '#features' }, { label: 'Templates', url: '#video' }, { label: 'Pricing', url: '#cta' }, { label: 'Help', url: '#lead' }], loginLabel: '', loginUrl: '', ctaLabel: 'Get Started Free' } },
      {
        type: 'DreamhomeHero',
        props: {
          id: 'dh-hero', headline: 'Create Personalized Videos That Get Results',
          subhead: 'Record once. Personalize for every prospect. Grow your business with SmartVideo AI.',
          background: '/landing-art/dreamhome/bg.webp', chip: 'Your Dream Home is Closer Than You Think', photo: '/landing-art/dreamhome/poster.webp',
          formTitle: 'Get Your Free Personalized Video', formSubtitle: 'Enter your name and email to see how easy it is to create stunning, personalized videos.',
          formFields: [{ key: 'name', label: 'Your Name', type: 'text', required: true }, { key: 'email', label: 'Your Email Address', type: 'email', required: true }],
          submitLabel: 'Watch My Video', privacy: '', orLabel: 'or', buttons: [{ label: 'Book a Demo', url: 'mailto:hello@example.com' }],
        },
      },
      {
        type: 'DreamhomeFeatures',
        props: {
          id: 'dh-features',
          items: [
            { image: '/landing-art/dreamhome/f1.webp', text: 'Personalize\nin Minutes' },
            { image: '/landing-art/dreamhome/f2.webp', text: 'Find & Target\nLocal Leads' },
            { image: '/landing-art/dreamhome/f3.webp', text: 'Track Your\nResults' },
            { image: '/landing-art/dreamhome/f4.webp', text: 'Easy to Use\nNo Tech Skills' },
          ],
        },
      },
      {
        type: 'DreamhomeProof',
        props: {
          id: 'dh-proof', title: 'Trusted by Professionals Like You',
          quotes: [
            { photo: '/landing-art/dreamhome/q1.webp', text: 'SmartVideo AI has transformed the way I connect with clients.', name: 'Sarah Mitchell', role: 'Real Estate Agent', stars: 5 },
            { photo: '/landing-art/dreamhome/q2.webp', text: 'I\u2019m getting more leads and closing more deals.', name: 'David Reynolds', role: 'Realtor', stars: 5 },
            { photo: '/landing-art/dreamhome/q3.webp', text: 'Incredible tool. Simple, powerful, and effective!', name: 'Jennifer Clarke', role: 'Real Estate Broker', stars: 5 },
          ],
        },
      },
      {
        type: 'DreamhomeCta',
        props: {
          id: 'dh-cta', title: 'Ready to Grow Your Business?', text: 'Join thousands of professionals using SmartVideo AI to get more leads and close more deals.',
          buttonLabel: 'Start Free Today', buttonUrl: '#lead', image: '/landing-art/dreamhome/laptop.webp',
        },
      },
    ],
    zones: {},
  },
};
