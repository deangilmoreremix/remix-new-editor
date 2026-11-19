/**
 * Design 09: "Enterprise navy". Navy glass-building hero (video left, headline middle, demo form right),
 * a white strip of enterprise logo names, three feature columns, a compliance strip, testimonials and a
 * navy contact band. All company names, logos, certifications (SOC 2, ISO 27001, GDPR/CCPA), figures and
 * quotes are SAMPLE copy from the supplied design: replace them with your own before sending.
 */
const it = (title, extra = {}) => ({ title, ...extra });
const field = (key, label, type = 'text', required = true) => ({ key, label, type, required, placeholder: required ? `${label} *` : label });

export default {
  id: 'site-enterprise',
  name: 'Enterprise navy',
  description: 'Navy glass-building hero with video, headline and a demo form, enterprise logo strip, whitepaper, workflow and CRM columns, compliance strip, testimonials and a contact band. All names, logos, certifications and quotes are sample copy.',
  theme: { mode: 'light', accent: '#1a5fd0', highlight: '#5b9bff', bg: '#ffffff', text: '#0f1f45', font: 'system' },
  layout: 'site-enterprise', compose: 'site', canvas: 1672, customPlayer: true, adaptive: true, family: 'site', radius: 8,
  vars: {
    '--vp-s-hero': 'linear-gradient(120deg, #0a1a3a 0%, #12305f 55%, #0b2146 100%)',
    '--vp-s-card': '#ffffff', '--vp-s-line': '#dfe6f0', '--vp-s-muted': '#4a5878',
    '--vp-surface': '#ffffff', '--vp-surface-2': '#f2f5f9', '--vp-line': '#dfe6f0',
  },
  site: {
    hero: {
      photo: '/landing-art/09/presenter.webp', variant: 'video-copy-form',
      eyebrow: 'PERSONALIZED VIDEO AT ENTERPRISE SCALE',
      bullets: ['Higher response rates', 'More qualified pipeline', 'Built for enterprise'],
      chip: 'Personalized for you, {{firstname|Alex}}', actions: 'none',
    },
    nav: { links: ['Platform', 'Solutions', 'Resources', 'Customers', 'Security', 'Pricing'].map((label) => ({ label, url: '' })), login: 'Book a Demo', loginUrl: '', cta: 'Get Started' },
    strip: { kind: 'logos', title: 'Trusted by leading enterprise teams', items: ['Microsoft', 'ORACLE', 'salesforce', 'aws', 'accenture', 'Deloitte.', 'workday'].map((x) => it(x)) },
    cards: [
      { type: 'heading', w: 4, eyebrow: 'BUILD A HIGH-QUALITY PIPELINE', title: 'List-Building That Fuels Personalized Outreach', text: 'Turn engagement into a predictable pipeline with enterprise-grade lead capture and list growth.' },
      { type: 'checklist', w: 4, title: 'Pipeline checklist', items: [it('Lead capture from demos, content, and events'), it('Downloadable whitepapers & resources'), it('Automatic list enrichment and segmentation'), it('Sync new leads to your CRM and outreach workflows')] },
      { type: 'playbook', w: 4, title: 'Download the Whitepaper', cover: 'The Enterprise Guide to Personalized Video Outreach', text: 'Learn how enterprise teams use personalized video to drive higher engagement, more qualified leads, and faster revenue.', button: 'Download Now', placeholder: 'Work Email *' },
      { type: 'heading', w: 4, eyebrow: 'BUILT FOR TEAMS', title: 'A Collaborative Workflow for GTM Teams' },
      { type: 'features', w: 4, title: 'Workflow features', items: [it('Team collaboration & approvals', { icon: 'users', text: 'Keep marketing, sales, and RevOps aligned.' }), it('Templates & brand controls', { icon: 'layers', text: 'Maintain a consistent, enterprise brand.' }), it('Performance & pipeline insights', { icon: 'chart', text: 'Track engagement, conversions, and ROI.' })] },
      { type: 'heading', w: 4, eyebrow: 'CONNECT YOUR TECH STACK', title: 'Seamless CRM Integration', text: 'Keep your data, teams, and outreach in sync with enterprise-ready CRM integrations.' },
      { type: 'stats', w: 4, title: '+ More enterprise integrations', items: [it('', { value: 'salesforce' }), it('', { value: 'Microsoft Dynamics 365' }), it('', { value: 'HubSpot' })] },
      { type: 'features', w: 12, title: 'Enterprise-Grade Security & Compliance', items: [it('SOC 2 Type II', { icon: 'shield', text: 'Certified' }), it('ISO 27001', { icon: 'globe', text: 'Compliant' }), it('Enterprise-Grade', { icon: 'lock', text: 'Encryption (in transit & at rest)' }), it('GDPR & CCPA', { icon: 'layers', text: 'Ready' })] },
      { type: 'heading', w: 3, title: 'A secure, reliable platform built for global enterprises.' },
      {
        type: 'quotes', w: 12, title: 'What Our Customers Say',
        items: [
          { text: "VideoReach has become a core part of our outreach strategy. We're seeing significantly higher engagement and more qualified meetings across our enterprise accounts.", by: 'Jennifer Carter', title: 'VP of Enterprise Sales, Oracle' },
          { text: 'The ability to personalize video at scale, while keeping our brand and compliance standards intact, makes VideoReach a perfect fit for our global sales organization.', by: 'Mark Delaney', title: 'Head of GTM Operations, Deloitte' },
          { text: "It's easy for our teams to use, integrates seamlessly with our CRM, and has delivered a measurable lift in pipeline. A true enterprise solution.", by: 'Priya Menon', title: 'Chief Revenue Officer, Workday' },
        ],
      },
    ],
    band: { title: 'Ready to Scale Personalized Outreach?', text: 'Contact our team to learn how VideoReach can help you drive more engagement, qualified leads, and revenue at enterprise scale.', button: 'Contact Us', placeholder: 'Work Email *', social: '' },
  },
  defaults: {
    headline: 'Scale Personalized Outreach That Drives [[Pipeline]]',
    subhead: 'Create, personalize, and deliver high-impact video outreach to the right prospects at scale. Generate more qualified leads, accelerate conversations, and grow revenue across your go-to-market teams.',
    form: {
      title: 'Get a Personalized Demo', subtitle: 'See how VideoReach can help your team scale personalized outreach and generate more pipeline.', submitLabel: 'Book a Demo',
      privacy: 'We respect your privacy. Your information is secure and will never be shared.',
      fields: [field('firstname', 'First Name'), field('lastname', 'Last Name'), field('email', 'Work Email', 'email'), field('company', 'Company'), field('title', 'Job Title', 'text', false), field('teamsize', 'Team Size', 'text', false)],
    },
    ctas: [],
  },
};
