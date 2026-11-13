/**
 * Site-style templates (from the "SmartVideo AI landing page designs"). Each one is DATA: palette, type,
 * radius, hero arrangement and the sample content for its proof strip and cards. The renderer
 * (siteLayout.js) and stylesheet (video-site.css) do the rest.
 *
 * All names, figures, quotes and logos below are SAMPLE copy so the page looks finished in the editor.
 * Replace them with your own before sending: nothing here is a real customer, result or endorsement.
 * This module must not import templates.js (templates.js imports it).
 */

const it = (title, extra = {}) => ({ title, ...extra });
const quote = (text, by, role, w = 3) => ({ type: 'quotes', w, items: [{ text, by, title: role }] });
const nav = (links, cta, login = 'Log In') => ({ links: links.map((label) => ({ label, url: '' })), login, loginUrl: '', cta });
const fieldSet = (...f) => f.map(([key, label, type = 'text', required = true, placeholder = ''], i) => ({ key, label, type, required, placeholder: placeholder || label, i })).map(({ i, ...rest }) => rest);

const NAME_EMAIL_COMPANY = fieldSet(['name', 'Your Name'], ['email', 'Your Email', 'email'], ['company', 'Your Company', 'text', false]);

export const SITE_TEMPLATES = [
  {
    id: 'site-leadiq',
    name: 'Neon lead-gen',
    description: 'Dark glass look: video, headline and demo form across the top, then a playbook card, mini CRM and results.',
    theme: { mode: 'dark', accent: '#19d9c6', highlight: '#7dd3fc', bg: '#060a1c', text: '#f1f5ff', font: 'system' },
    layout: 'site-leadiq', compose: 'site', customPlayer: true, adaptive: true, family: 'site', radius: 16,
    vars: { '--vp-s-hero': 'radial-gradient(1200px 500px at 10% -10%, rgba(124,58,237,.45), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(20,184,166,.35), transparent 55%), #060a1c', '--vp-s-card': 'rgba(255,255,255,.05)', '--vp-s-line': 'rgba(148,163,255,.25)', '--vp-s-muted': '#b6bfdc', '--vp-surface': '#11163a', '--vp-surface-2': '#0b1030', '--vp-line': 'rgba(148,163,255,.25)' },
    approx: { surface: '#11163a' },
    site: {
      hero: { variant: 'video-copy-form', eyebrow: 'Personalized Video Lead Generation Platform', bullets: ['Personalized videos that get higher responses', 'Built-in lead capture and list growth tools', 'Track, nurture, and close leads in one platform'], chip: 'Personal Video for {{firstname|you}}', actions: 'form' },
      nav: nav(['Product', 'Solutions', 'Pricing', 'Resources', 'Customers'], 'Start Free Trial'),
      strip: { kind: 'benefits', title: '', items: [it('Personalized Video at Scale', { icon: 'video' }), it('Build & Grow Your List', { icon: 'users' }), it('Automated Lead Capture', { icon: 'bolt' }), it('Lead Tracking & Mini CRM', { icon: 'layers' }), it('Book More Sales Calls', { icon: 'calendar' }), it('Higher Conversions & Revenue', { icon: 'chart' })] },
      cards: [
        { type: 'playbook', w: 4, eyebrow: 'FREE RESOURCE', title: 'Get the Personalized Video Playbook', cover: 'The Personalized Video Playbook', text: 'Join our email list and get our proven framework, templates, and scripts to generate more leads with video.', button: 'Send Me the Playbook', placeholder: 'Enter your email' },
        { type: 'table', w: 4, title: 'Lead Tracker (Mini CRM)', cols: ['Lead', 'Company', 'Engagement', 'Status'], items: [it('Sarah Chen', { text: 'Acme Co.', value: '100% watched', tag: 'Hot Lead' }), it('James Miller', { text: 'BrightTech', value: '87% watched', tag: 'Contacted' }), it('Elena Rodriguez', { text: 'GrowthLabs', value: '72% watched', tag: 'Nurturing' }), it('David Park', { text: 'NextWave', value: '56% watched', tag: 'New Lead' })] },
        { type: 'stats', w: 4, title: 'Real Results for Growth-Minded Businesses', items: [it('Lead Conversion', { value: '+317%', icon: 'target' }), it('List Growth', { value: '+4.2x', icon: 'users' }), it('More Booked Calls', { value: '68%', icon: 'calendar' }), it('Pipeline Value', { value: '+289%', icon: 'chart' })] },
        { type: 'heading', w: 3, eyebrow: 'CUSTOMER LOVE', title: 'What Our Users Are Saying' },
        quote('Our email list grew by 3x in 30 days and the personalized videos get way more replies than standard emails.', 'Melissa Grant', 'CEO, Grant Marketing'),
        quote('Made it simple to create personalized outreach at scale. More leads, more calls, more real opportunities.', 'Ryan Carter', 'Founder, Carter Growth'),
        quote('The built-in lead tracking and automation is a game-changer. Like a marketing assistant that never sleeps.', 'Priya Desai', 'CMO, Elevate Brands'),
      ],
      band: { title: 'Join 10,000+ marketers and business owners getting higher-quality leads with personalized video.', text: '', button: 'Get Started Free', placeholder: 'Enter your email address', social: 'Follow Us' },
    },
    defaults: {
      headline: "{{firstname|Hi}}, here's a smarter way to [[grow your business.]]",
      subhead: 'Create personalized videos at scale, capture more qualified leads, and turn interest into real conversations, automatically.',
      form: { title: 'Get Your Personalized Demo', subtitle: 'See how we can help you generate more leads and grow faster.', submitLabel: 'Get My Personalized Demo', fields: NAME_EMAIL_COMPANY },
      ctas: [{ label: 'Book a 15-Min Strategy Call', kind: 'calendar', value: '', style: 'secondary' }],
    },
  },
  {
    id: 'site-lead',
    name: 'Clean SaaS',
    description: 'Light and purple: copy, video and form across the top, a logo strip, then six small cards.',
    theme: { mode: 'light', accent: '#5b45e6', highlight: '#6d4aff', bg: '#f7f6ff', text: '#14143a', font: 'system' },
    layout: 'site-lead', compose: 'site', customPlayer: true, adaptive: true, family: 'site', radius: 16,
    vars: { '--vp-s-hero': 'radial-gradient(900px 400px at 0% 0%, #e9e5ff, transparent 60%), #f7f6ff', '--vp-s-card': '#ffffff', '--vp-s-line': '#e6e3f7', '--vp-s-muted': '#55557a', '--vp-surface': '#ffffff', '--vp-surface-2': '#f1efff', '--vp-line': '#e6e3f7' },
    site: {
      hero: { variant: 'copy-video-form', eyebrow: 'Personalized Video Lead Generation', bullets: ['Personalize at scale', 'Capture & segment leads', 'Follow up with higher conversions'], chip: 'Hi {{firstname|there}}!', actions: 'none' },
      nav: nav(['Product', 'Solutions', 'Resources', 'Pricing'], 'Book a Demo'),
      strip: { kind: 'logos', title: 'Trusted by growth-focused teams', items: [it('Notionly'), it('Cloudway'), it('BrightPath'), it('ScaleCRM'), it('Nexora')] },
      cards: [
        { type: 'heading', w: 12, title: 'A Complete List-Building Platform for Video-Led Growth', text: 'Capture more leads, grow high-quality lists, and turn interest into pipeline, all with personalized video.' },
        { type: 'playbook', w: 4, title: 'Downloadable Guide Signup', cover: 'The Personalized Video Playbook', text: 'Grow your list with high-value resources.', button: 'Get the Free Guide', placeholder: 'Your Email' },
        { type: 'checklist', w: 4, title: 'Contact Segmentation', items: [it('Marketing Pros   1,248'), it('Sales Teams   842'), it('Enterprise   309'), it('Partners   176')] },
        { type: 'quotes', w: 4, title: 'What Our Customers Say', items: [{ text: 'Personalized video has completely changed our lead generation. We are seeing higher engagement and 3x more qualified leads.', by: 'Jordan Miller', title: 'Head of Growth, BrightPath' }] },
        { type: 'features', w: 4, title: 'Key Features', items: [it('Personalized video at scale', { icon: 'video', text: 'Create 1:1 videos in minutes.' }), it('Lead capture & list-building', { icon: 'filter', text: 'Turn views into qualified leads.' }), it('Automated follow-ups', { icon: 'bolt', text: 'Keep leads engaged and moving.' }), it('Performance insights', { icon: 'chart', text: 'Track views, conversions, and ROI.' })] },
        { type: 'stats', w: 4, title: 'Leads Overview', items: [it('Total Leads', { value: '2,847' }), it('vs. last month', { value: '+42%' }), it('Conversion', { value: '18.6%' })] },
        { type: 'table', w: 4, title: 'Recent Leads', cols: ['Lead', 'Company', 'Status'], items: [it('Alex Carter', { text: 'Acme Co.', tag: 'Qualified' }), it('Taylor Reed', { text: 'NovaTech', tag: 'In Progress' }), it('Morgan Lee', { text: 'BrightPath', tag: 'New' })] },
      ],
      band: { title: 'Get list-building tips and product updates', text: 'One short email, now and then.', button: 'Subscribe', placeholder: 'Enter your email', social: '' },
    },
    defaults: {
      headline: 'Turn Personalized Videos Into [[Qualified Leads]]',
      subhead: 'Create, send, and track personalized videos at scale to capture more leads, build stronger relationships, and grow your pipeline.',
      form: { title: 'Get Your Personalized Video Strategy', subtitle: 'See how personalized video can drive more leads for your business.', submitLabel: 'Get My Personalized Demo', fields: fieldSet(['name', 'Your Name'], ['email', 'Work Email', 'email'], ['company', 'Company', 'text', false]) },
      ctas: [],
    },
  },
  {
    id: 'site-reach',
    name: 'Bold red outreach',
    description: 'Red wave hero with video and form, rating strip, benefits, results, steps, testimonials and an FAQ.',
    theme: { mode: 'light', accent: '#dc2626', highlight: '#f59e0b', bg: '#ffffff', text: '#1a1414', font: 'display' },
    layout: 'site-reach', compose: 'site', customPlayer: true, adaptive: true, family: 'site', radius: 12,
    vars: { '--vp-s-hero': 'linear-gradient(115deg, #7f1010 0%, #c81e1e 45%, #ef4444 100%)', '--vp-s-card': '#ffffff', '--vp-s-line': '#f1d9d4', '--vp-s-muted': '#5d4a47', '--vp-surface': '#ffffff', '--vp-surface-2': '#fff5f2', '--vp-line': '#f1d9d4' },
    site: {
      hero: { variant: 'copy-video-form', eyebrow: 'PERSONALIZED VIDEO OUTREACH PLATFORM', bullets: ['Higher Response Rates', 'More Qualified Leads', 'More Meetings & Sales'], chip: 'A Personalized Video for You!', actions: 'form' },
      nav: nav(['How It Works', 'Features', 'Results', 'Testimonials', 'Pricing', 'FAQ'], 'Get Started Free', 'Book a Demo'),
      strip: { kind: 'logos', title: 'Trusted by Growth-Focused Teams', items: [it('HubSpot'), it('salesforce'), it('pipedrive'), it('ZOHO'), it('shopify'), it('ClickUp')] },
      cards: [
        { type: 'playbook', w: 4, eyebrow: 'FREE LEAD MAGNET', title: 'Get the Personalized Video Playbook', cover: 'The Personalized Video Playbook', text: 'A step-by-step guide to generating more leads and meetings with video outreach.', button: 'Get the Free Guide', placeholder: 'Enter your email address' },
        { type: 'features', w: 5, title: 'Why We Drive More Leads', items: [it('Create Personalized Videos', { icon: 'video', text: 'Use your name, company, and custom touches.' }), it('Build Your Lead List', { icon: 'users', text: 'Capture and organize high-intent leads.' }), it('Automate Outreach', { icon: 'bolt', text: 'Send at scale without losing the personal touch.' }), it('Track & Convert', { icon: 'chart', text: 'See opens, views, and replies to turn interest into meetings.' })] },
        { type: 'stats', w: 3, title: 'Real Results from Our Customers', items: [it('Higher Response Rate', { value: '3.4x' }), it('More Qualified Leads', { value: '57%' }), it('More Meetings Booked', { value: '2.8x' })] },
        { type: 'steps', w: 4, title: 'How It Works', items: [it('Build Your List', { text: 'Attract leads with valuable content & offers.' }), it('Personalize & Reach Out', { text: 'Send one-to-one videos that get opened & watched.' }), it('Book Meetings', { text: 'Turn interest into real conversations.' }), it('Convert & Grow', { text: 'Close more deals and build long-term customers.' })] },
        { type: 'quotes', w: 5, title: 'What Our Customers Are Saying', items: [{ text: 'Our response rate jumped from 8% to 32% after adding personalized video outreach.', by: 'Jessica R.', title: 'Head of Marketing, SaaSCo' }, { text: 'Like 1:1 outreach at scale. We booked 3.4x more meetings and our pipeline is fuller than ever.', by: 'Mark T.', title: 'Founder, GrowthLabs' }, { text: 'Super easy to use, and the results are real. More replies, more conversations, more closed deals.', by: 'Emily K.', title: 'Sales Director, CloudEdge' }] },
        { type: 'faq', w: 3, title: 'Frequently Asked Questions', items: [it('What is this?', { text: 'A way to send one-to-one personalized videos and capture the leads they generate.' }), it('How does personalized video outreach work?', { text: 'Record once, then each contact sees their own name and company on their own link.' }), it('Can I build a lead list inside the platform?', { text: 'Yes. Every form submission is saved as a lead.' }), it('Do I need video editing experience?', { text: 'No.' }), it('Is there a free trial?', { text: 'Add your answer here.' })] },
      ],
      band: { title: 'Get Lead-Gen Tips, Templates & Growth Strategies Straight to Your Inbox', text: 'Proven outreach strategies · Done-for-you templates · Exclusive growth insights', button: 'Send Me the Best Tips', placeholder: 'Enter your email address', social: '' },
    },
    defaults: {
      headline: 'Turn More Prospects Into Customers with [[Personalized Outreach]]',
      subhead: 'Create, send, and track personalized videos at scale to generate more leads, build real relationships, and close more deals, with less effort.',
      form: { title: 'Get More Leads with Personalized Videos', subtitle: 'See how we can help you generate, engage, and convert more prospects.', submitLabel: 'Get My Personalized Demo', fields: fieldSet(['firstname', 'First Name'], ['lastname', 'Last Name', 'text', false], ['email', 'Work Email', 'email'], ['company', 'Company Name']) },
      ctas: [{ label: 'Book a Live Demo', kind: 'calendar', value: '', style: 'secondary' }],
    },
  },
  {
    id: 'site-persona',
    name: 'Luxury concierge',
    description: 'Cream and gold with serif type: large video, private-consultation form, logos, testimonials and a 4-step onboarding.',
    theme: { mode: 'light', accent: '#8a6a1f', highlight: '#8a6a1f', bg: '#f7f0e6', text: '#2a2118', font: 'serif' },
    layout: 'site-persona', compose: 'site', customPlayer: true, adaptive: true, family: 'site', radius: 6,
    vars: { '--vp-s-hero': 'linear-gradient(180deg, #fbf6ee 0%, #f3e9da 100%)', '--vp-s-card': '#fffaf2', '--vp-s-line': '#e4d6bf', '--vp-s-muted': '#5e5242', '--vp-surface': '#fffaf2', '--vp-surface-2': '#f6ecdc', '--vp-line': '#e4d6bf' },
    site: {
      hero: { variant: 'video-copy-form', eyebrow: 'PERSONALIZED VIDEO LEAD GENERATION', bullets: ['Higher Engagement', 'More Qualified Leads', 'Greater Revenue'], chip: 'A Personalized Message for You, {{firstname|friend}}', actions: 'copy' },
      nav: nav(['Platform', 'Solutions', 'How It Works', 'Success Stories', 'Resources'], 'Book a Private Strategy Call', ''),
      strip: { kind: 'logos', title: 'TRUSTED BY LEADING BRANDS', items: [it('Forbes'), it('LUXE REALTY'), it('VANTAGE CAPITAL'), it('Asteria'), it('CARRINGTON'), it('The Haven')] },
      cards: [
        { type: 'heading', w: 3, eyebrow: 'RESULTS OUR CLIENTS LOVE', title: 'Real Connections. Real Growth.' },
        quote('The personalized videos helped us 3x our qualified pipeline in just 60 days.', 'Michael Reeves', 'CEO, Vantage Capital'),
        quote('It feels like a white-glove experience for our prospects, and the results are exceptional.', 'Elena Carrington', 'Founder, Carrington Advisors'),
        quote('A game-changer for our outreach and lead generation. Personal, scalable, and proven.', 'James Park', 'Managing Partner, Luxe Realty'),
        { type: 'steps', w: 12, eyebrow: 'THE CONCIERGE ONBOARDING EXPERIENCE', title: 'From Vision to Leads: White-Glove, End to End.', items: [it('Discover', { text: 'A strategy consultation to align on your goals.', icon: 'calendar' }), it('Personalize', { text: 'We craft your branded, personalized video experience.', icon: 'video' }), it('Launch', { text: 'Go live with a guided, concierge rollout.', icon: 'send' }), it('Grow', { text: 'Capture, nurture, and convert more of the right leads.', icon: 'chart' })] },
        { type: 'playbook', w: 6, eyebrow: 'FEATURED RESOURCE', title: 'The Personalized Video Playbook', cover: 'The Personalized Video Playbook', text: 'A strategic guide to higher engagement, more qualified leads, and lasting client relationships.', button: 'Download the Free Playbook', placeholder: 'Your email address' },
        { type: 'heading', w: 6, eyebrow: 'HAVE A QUESTION?', title: "Let's Connect", text: 'Our team is here to help you explore the right personalized video strategy for your business.' },
      ],
      band: { title: "Be the First to See What's Next", text: 'Get exclusive insights, product updates, and lead-generation strategies delivered to your inbox.', button: 'Sign Up', placeholder: 'Your email address', social: '' },
    },
    defaults: {
      headline: 'Turn Personal Connection into [[Predictable Growth]]',
      subhead: 'Create, deliver, and scale personalized videos that captivate, qualify, and convert your ideal prospects, all on one elegant platform.',
      form: { title: 'Request a Private Consultation', subtitle: "Let's explore how personalized video can drive results for your business.", submitLabel: 'Request My Consultation', privacy: 'A concierge will be in touch within 1 business day.', fields: fieldSet(['name', 'Full Name'], ['email', 'Business Email', 'email'], ['company', 'Company', 'text', false], ['message', 'Tell us about your goals', 'textarea', false]) },
      ctas: [{ label: 'Start Your Personalized Video Experience', kind: 'form', value: '', style: 'primary' }],
    },
  },
  {
    id: 'site-spark',
    name: 'Playful sunshine',
    description: 'Yellow, teal and coral with chunky type and rounded cards: newsletter, 3 steps, leads list and testimonials.',
    theme: { mode: 'light', accent: '#e8473b', highlight: '#1d4ed8', bg: '#fffaf0', text: '#1b1b2f', font: 'display' },
    layout: 'site-spark', compose: 'site', customPlayer: true, adaptive: true, family: 'site', radius: 22,
    vars: { '--vp-s-hero': 'radial-gradient(520px 320px at 100% 0%, #5eead4aa, transparent 60%), radial-gradient(520px 320px at 0% 100%, #fde047, transparent 60%), #fff1b8', '--vp-s-card': '#ffffff', '--vp-s-line': '#1b1b2f22', '--vp-s-muted': '#4b4b63', '--vp-surface': '#ffffff', '--vp-surface-2': '#fff7da', '--vp-line': '#1b1b2f22' },
    site: {
      hero: { variant: 'copy-video-form', eyebrow: '', bullets: [], chip: 'Personalized for you, {{firstname|friend}}!', actions: 'form' },
      nav: nav(['Features', 'How It Works', 'Pricing', 'Customers', 'Resources'], 'Schedule a Demo'),
      strip: { kind: 'benefits', title: '', items: [it('Personalize at Scale', { icon: 'video', text: 'One-to-one videos in minutes' }), it('Generate More Leads', { icon: 'users', text: 'Turn views into a growing list' }), it('Boost Engagement', { icon: 'bolt', text: 'Get higher replies & conversions' }), it('Grow Your Business', { icon: 'chart', text: 'More leads, more meetings, more sales' })] },
      cards: [
        { type: 'playbook', w: 5, eyebrow: 'FREE: PDF', title: 'Join Our Growth Newsletter', cover: 'The Personalized Video Playbook', text: 'Weekly video marketing tips, real examples, and lead-gen playbooks.', button: 'Get the Free Playbook', placeholder: 'Enter your email' },
        { type: 'steps', w: 7, title: 'Get Started in 3 Simple Steps', items: [it('Connect & Customize', { text: 'Add your brand, message, and a few personal touches.', icon: 'video' }), it('Import Your List', { text: 'Add leads or connect your favorite tools (CRM, forms, etc.).', icon: 'users' }), it('Send & Grow', { text: 'Deliver personalized videos and watch your leads (and list!) grow.', icon: 'send' })] },
        { type: 'quotes', w: 8, title: 'Loved by Growing Businesses', items: [{ text: 'Our lead list grew 3x in just one month!', by: 'Maya L.', title: 'Marketing Agency' }, { text: 'Personalized videos feel so human, our reply rate is 48%!', by: 'Carlos P.', title: 'SaaS Founder' }, { text: 'Super easy to set up, and it actually drives qualified leads.', by: 'Nina C.', title: 'Real Estate Group' }] },
        { type: 'table', w: 4, title: 'Your Leads, All in One Place', cols: ['Lead', 'Type', 'Status'], items: [it('Alex M.', { text: 'Marketing Agency', tag: 'Viewed' }), it('Jamie R.', { text: 'Real Estate', tag: 'Clicked' }), it('Taylor K.', { text: 'SaaS Startup', tag: 'Replied' })] },
        { type: 'features', w: 12, title: 'Why Businesses Love It', items: [it('Higher Conversions', { icon: 'target' }), it('Bigger, Healthier Lists', { icon: 'users' }), it('Stronger Relationships', { icon: 'heart' }), it('Long-Term Growth', { icon: 'chart' })] },
      ],
      band: { title: 'Start Growing Your Lead List Today!', text: '', button: 'Get Started Free', placeholder: 'Enter your email', social: '' },
    },
    defaults: {
      headline: 'Turn Prospects into Fans with [[Personalized Videos!]]',
      subhead: 'Create and send custom videos at scale to attract qualified leads, build real connections, and grow your business faster.',
      form: { title: 'Get Your Own Personalized Video!', subtitle: '', submitLabel: 'Create My Personalized Video', privacy: 'No credit card needed. Personalized for your business.', fields: fieldSet(['name', 'Your Name'], ['email', 'Your Email', 'email'], ['business', 'Your Business Type', 'text', false]) },
      ctas: [{ label: 'Schedule a Demo', kind: 'calendar', value: '', style: 'secondary' }],
    },
  },
];
