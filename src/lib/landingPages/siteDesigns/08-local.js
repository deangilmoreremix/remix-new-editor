/**
 * Site template 08: "Local business". Warm cream and orange with a green footer band, a shop-owner photo hero and
 * four cards (checklist, follow-up steps, testimonials, service-area map). Pixel-matched at 1672px wide (styles/site/08-local.css).
 * All names, figures and quotes are SAMPLE copy. This module must not import templates.js.
 */
const it = (title, extra = {}) => ({ title, ...extra });
const field = (key, label, type = 'text', required = true) => ({ key, label, type, required, placeholder: `${label} *` });

export default {
  id: 'site-local',
  name: 'Local business',
  description: 'Warm cream and orange with a shop-owner photo hero, industry tiles, four cards and a green newsletter band.',
  theme: { mode: 'light', accent: '#e8691c', highlight: '#f7b500', bg: '#fbf4e6', text: '#1f3326', font: 'display' },
  layout: 'site-local', compose: 'site', canvas: 1672, customPlayer: true, adaptive: true, family: 'site', radius: 16,
  vars: { '--vp-s-hero': 'linear-gradient(180deg, #fbf4e6, #f6ead2)', '--vp-s-card': '#ffffff', '--vp-s-line': '#efe3cc', '--vp-s-muted': '#4b5a4f', '--vp-surface': '#ffffff', '--vp-surface-2': '#fbf4e6', '--vp-line': '#efe3cc' },
  site: {
    hero: {
      photo: '/landing-art/08/presenter.webp', variant: 'copy-video-form', eyebrow: 'Personalized Videos that',
      bullets: ['Personalized Videos', 'Capture Leads', 'Automated Follow-Up', 'More Customers'],
      chip: 'Hi Neighbor!', actions: 'form',
    },
    nav: {
      links: ['How It Works', 'Features', 'For Local Businesses', 'Pricing', 'Reviews', '(855) 742-3684'].map((label) => ({ label, url: '' })),
      login: 'Request Demo', loginUrl: '', cta: 'Schedule a Consultation',
    },
    strip: {
      kind: 'benefits', title: '',
      items: [it('Home Services', { icon: 'building' }), it('Pet Care', { icon: 'heart' }), it('Health & Wellness', { icon: 'heart' }), it('Salons & Spas', { icon: 'star' }), it('Restaurants & Cafés', { icon: 'star' }), it('Local Retail', { icon: 'building' }), it('Auto Services', { icon: 'star' }), it('And many more!', { icon: 'arrow' })],
    },
    cards: [
      { type: 'heading', w: 3, title: 'Built for\nLocal & Service\nBusinesses', text: 'A simple, powerful way to connect with more people in your area.' },
      { type: 'checklist', w: 3, title: 'Why Local Businesses Love It', items: [it('Get more qualified leads from your community'), it('Build and grow your customer list'), it('Stand out with personal, human video messages'), it('Automatically follow up and turn leads into bookings'), it('Easy to set up and manage — no tech headaches')] },
      { type: 'heading', w: 3, title: 'Automatic Follow-Up\nThat Keeps Leads Moving', text: 'Turn new leads into paying customers\nwith simple, automated video follow-ups.' },
      { type: 'steps', w: 3, title: '', items: [it('Collect Leads'), it('Send a Personalized Video'), it('Follow Up Automatically'), it('Get Bookings & More Customers')] },
      { type: 'quotes', w: 3, title: 'What Local Businesses Are Saying', items: [{ text: 'The personalized videos helped us get 40% more leads in just one month! It feels personal, local, and our customers love it.', by: 'Michelle T.', title: 'Riverside Home Services' }, { text: 'Super easy to use and it actually brings in real leads from our area. A game-changer for our small business.', by: 'David R.', title: 'Maple Grove Auto Care' }] },
      { type: 'heading', w: 3, title: 'Serving Your Local Community', text: 'Proudly serving Riverside, Maple Grove, Oak Hill, Pinecrest, Lakeside, and nearby areas!' },
    ],
    band: { title: 'Get Local Business Tips & Lead-Generation Ideas', text: 'Join our list for practical video marketing tips, local business growth strategies, and product updates.', button: 'Sign Me Up →', placeholder: 'Your Email', social: 'Ready to grow your business with personalized video?', tagline: 'Request a Demo or Schedule a Consultation →' },
  },
  defaults: {
    headline: 'Get More Leads\nfor Your [[Local Business]]',
    subhead: 'Send friendly, personalized video messages that attract new customers, collect leads, build your list, and turn interest into real business — in your community.',
    form: {
      title: 'Get a Personalized Demo', subtitle: 'See how personalized video can bring more leads and customers to your business.', submitLabel: 'Get My Demo →',
      fields: [field('name', 'Your Name'), field('email', 'Email Address', 'email'), field('phone', 'Phone Number', 'tel'), field('company', 'Business Name')],
    },
    ctas: [{ label: 'Schedule a Free Consultation', kind: 'calendar', value: '', style: 'secondary' }],
  },
};
