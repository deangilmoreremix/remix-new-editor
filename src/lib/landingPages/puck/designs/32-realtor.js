/** Puck design 32: "Real estate page (phone demo)". White nav, blue house-photo hero with form, icon strip, video + copy, steps with phone mockup, testimonials, photo CTA band. SAMPLE copy only. */
const field = (key, label, type = 'text') => ({ key, label, type, required: true });
const quote = (id, text, name, role, avatar) => ({ type: 'QuoteCard', props: { id, columns: 1, heading: '', quotes: [{ text, name, role, avatar }] } });

export default {
  id: 'puck-realtor',
  designClass: 'realtor',
  name: 'Real estate page (phone demo)',
  description: 'Blue real-estate page with a house-photo hero and lead form, a personalized-video section, a three-step phone demo, testimonials and a closing band (sample content).',
  theme: { mode: 'light', accent: '#1f6bf2', highlight: '#8fc2ff', bg: '#ffffff', text: '#14284b', font: 'system' },
  layout: 'puck',
  puck: true,
  radius: 8,
  puckData: {
    root: { props: { design: 'realtor', accent: '#1f6bf2', background: '#ffffff', text: '#14284b', surface: '#ffffff' } },
    content: [
      { type: 'RealtorNav', props: { id: 'rl-nav', brand: 'SmartVideo AI', tagline: 'Personalized Videos. Real Results.', logo: '/landing-art/realtor/logo.webp', links: ['Home', 'Features', 'Templates', 'Pricing', 'Support'].map((label) => ({ label, url: '' })), ctaLabel: 'Get Started Free', ctaUrl: '#lead' } },
      {
        type: 'RealtorHero',
        props: {
          id: 'rl-hero', background: '/landing-art/realtor/hero.webp', eyebrow: 'REAL ESTATE PROFESSIONALS',
          headline: 'Turn More Leads Into Listings with Personalized [[Video Outreach]]',
          subhead: 'Create stunning, personalized real estate videos in minutes. Connect with more buyers and sellers, build trust, and close more deals with SmartVideo AI.',
          bullets: [{ text: 'Personalize with the click of a button' }, { text: 'Showcase properties and local areas' }, { text: 'Stand out in a crowded market' }], formTitle: 'Get Your Free Personalized Real Estate Video',
          formSubtitle: 'Enter your name and email to create a custom video and see how SmartVideo AI can help you get more leads and listings.',
          formFields: [field('name', 'Your Name'), field('email', 'Your Email Address', 'email')], submitLabel: 'Create My Free Video', privacy: 'Your information is secure and never shared.',
        },
      },
      { type: 'Strip', props: { id: 'rl-features', kind: 'benefits', title: '', items: [{ icon: 'home', title: 'Property Showcases', text: 'Highlight listings with professional video.', value: '' }, { icon: 'user', title: 'Personalized Outreach', text: 'Address prospects by name and interest.', value: '' }, { icon: 'pin', title: 'Local Area Videos', text: 'Showcase neighborhoods, schools and amenities.', value: '' }, { icon: 'chart', title: 'More Engagement', text: 'Get more replies, showings and closed deals.', value: '' }] } },
      { type: 'RealtorVideoSection', props: { id: 'rl-video', poster: '/landing-art/realtor/agent.webp', overlayText: 'Hi Sarah,\nYour dream home\nis waiting!', eyebrow: 'REAL PEOPLE. REAL CONNECTIONS.', title: 'Make Every Prospect Feel Like a VIP', text: 'With SmartVideo AI, you can create personalized real estate videos that include the right property, location, and message — all tailored to each lead. It’s the easiest way to build trust and get more responses.', callout: '[[Personalization]] increases response rates by [[up to 3x]] compared to generic outreach.' } },
      { type: 'RealtorSteps', props: { id: 'rl-steps', eyebrow: 'HOW IT WORKS', title: 'Get Started in 3 Easy Steps', steps: [{ title: 'Choose a Template', text: 'Pick from professionally designed real estate templates or start from scratch.' }, { title: 'Add Your Personal Touch', text: 'Include your name, contact details, property info and more.' }, { title: 'Share & Connect', text: 'Send your personalized video and start getting more leads and showings.' }], phoneName: 'Hi John,', phoneText: 'Here’s a quick look at a property that matches your needs...', phoneImage: '/landing-art/realtor/property.webp', phoneButton: 'Watch Your Video', note: 'Simple,\nfast and\npowerful!' } },
      { type: 'TextBlock', props: { id: 'rl-quotes-head', eyebrow: 'REAL ESTATE PROFESSIONALS LOVE IT', title: 'What Our Users Are Saying', text: '', align: 'left' } },
      {
        type: 'Grid',
        props: {
          id: 'rl-quotes', columns: 3,
          items: [
            quote('rl-q1', 'SmartVideo AI has completely changed the way I reach out to prospects. I’m getting more replies, more showings, and more sales!', 'Jennifer L.', 'Realtor®, Austin, TX', '/landing-art/realtor/t1.webp'),
            quote('rl-q2', 'The personalization feature is a game changer. My clients feel like I’m speaking directly to them, and it makes all the difference.', 'Mark T.', 'Real Estate Agent, Denver, CO', '/landing-art/realtor/t2.webp'),
            quote('rl-q3', 'Easy to use, professional results, and it helps me stand out in a competitive market. I highly recommend SmartVideo AI!', 'Lisa R.', 'Realtor®, Scottsdale, AZ', '/landing-art/realtor/t3.webp'),
          ],
        },
      },
      { type: 'RealtorCta', props: { id: 'rl-cta', eyebrow: 'READY TO GET MORE LISTINGS?', title: 'Start Creating Your Personalized Real Estate Videos Today', text: 'Join thousands of real estate professionals using SmartVideo AI to build stronger connections and close more deals.', buttonLabel: 'Get Started Free', buttonUrl: '#lead', note: 'No credit card required.' } },
      { type: 'Footer', props: { id: 'rl-footer', text: 'Sample content for illustration only.', links: [] } },
    ],
    zones: {},
  },
};
