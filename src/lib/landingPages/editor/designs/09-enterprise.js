// Enterprise navy: a long, corporate page. All company names, quotes, figures and compliance badges are SAMPLE copy: replace them with claims you can back up.
const f = (key, label, type = 'text', required = true) => ({ key, label, type, required });
const id = (n) => `ent-${n}`;

export default {
  id: 'editable-enterprise',
  name: 'Enterprise navy',
  description: 'Editable navy enterprise page: video, demo form, logo strip, list-building / workflow / CRM columns, security badges, testimonials and a contact band. Sample content only: company names, testimonials and compliance claims (SOC 2, ISO, GDPR) are placeholders, not real claims.',
  designClass: 'enterprise',
  theme: { mode: 'light', accent: '#1769e0', highlight: '#1769e0', bg: '#f3f6f9', text: '#0f1f3d', font: 'system' },
  layout: 'editable',
  editable: true,
  radius: 6,
  editorData: {
    root: { props: { design: 'enterprise', accent: '#1769e0', background: '#f3f6f9', text: '#0f1f3d', surface: '#ffffff' } },
    content: [
      {
        type: 'NavBar',
        props: {
          id: id('nav'), brand: 'SmartVideo AI', logo: '',
          links: [{ label: 'Platform', url: '' }, { label: 'Solutions', url: '' }, { label: 'Resources', url: '' }, { label: 'Customers', url: '' }, { label: 'Security', url: '' }, { label: 'Pricing', url: '' }],
          loginLabel: 'Book a Demo', loginUrl: '', ctaLabel: 'Get Started',
        },
      },
      {
        type: 'Hero',
        props: {
          id: id('hero'), variant: 'video-copy-form',
          eyebrow: 'Personalized video at enterprise scale',
          headline: 'Scale Personalized Outreach That Drives [[Pipeline]]',
          subhead: 'Create, personalize, and deliver high-impact video outreach to the right prospects at scale. Generate more qualified leads, accelerate conversations, and grow revenue across your go-to-market teams.',
          bullets: [{ text: 'Higher response rates' }, { text: 'More qualified pipeline' }, { text: 'Built for enterprise' }],
          buttons: [], chip: 'Personalized for you, {{firstname|there}}', photo: '/landing-art/09/presenter.webp', showForm: 'yes',
          formTitle: 'Get a Personalized Demo',
          formSubtitle: 'See how SmartVideo AI can help your team scale personalized outreach and generate more pipeline.',
          formFields: [f('firstname', 'First Name *'), f('lastname', 'Last Name *'), f('email', 'Work Email *', 'email'), f('company', 'Company *'), { key: 'jobtitle', label: 'Job Title', type: 'select', required: false, options: 'CEO / Founder, VP Sales, VP Marketing, Director, Manager, RevOps / Sales Ops, Other' }, { key: 'teamsize', label: 'Team Size', type: 'select', required: false, options: '1-10, 11-50, 51-200, 201-1,000, 1,000+' }],
          submitLabel: 'Book a Demo', privacy: 'We respect your privacy. Your information is secure and will never be shared.',
        },
      },
      {
        type: 'Strip',
        props: {
          id: id('logos'), kind: 'logos', title: 'Trusted by leading enterprise teams',
          items: ['Microsoft', 'ORACLE', 'salesforce', 'aws', 'accenture', 'Deloitte.', 'workday'].map((title) => ({ title, text: '', value: '', icon: '' })),
        },
      },
      {
        type: 'EnterpriseColumns',
        props: {
          id: id('cols'),
          listEyebrow: 'Build a high-quality pipeline', listTitle: 'List-Building That Fuels Personalized Outreach',
          listText: 'Turn engagement into a predictable pipeline with enterprise-grade lead capture and list growth.',
          checks: [{ text: 'Lead capture from demos, content, and events' }, { text: 'Downloadable whitepapers & resources' }, { text: 'Automatic list enrichment and segmentation' }, { text: 'Sync new leads to your CRM and outreach workflows' }],
          cardTitle: 'Download the Whitepaper', cardCover: 'The Enterprise Guide to Personalized Video Outreach', cardTag: 'Whitepaper',
          cardText: 'Learn how enterprise teams use personalized video to drive higher engagement, more qualified leads, and faster revenue.',
          cardPlaceholder: 'Work Email *', cardButton: 'Download Now',
          teamEyebrow: 'Built for teams', teamTitle: 'A Collaborative Workflow for GTM Teams',
          features: [
            { icon: 'users', title: 'Team collaboration & approvals', text: 'Keep marketing, sales, and RevOps aligned.' },
            { icon: 'layers', title: 'Templates & brand controls', text: 'Maintain a consistent, enterprise brand.' },
            { icon: 'chart', title: 'Performance & pipeline insights', text: 'Track engagement, conversions, and ROI.' },
          ],
          crmEyebrow: 'Connect your tech stack', crmTitle: 'Seamless CRM Integration',
          crmText: 'Keep your data, teams, and outreach in sync with enterprise-ready CRM integrations.',
          integrations: [{ name: 'salesforce', sub: '', mark: 'cloud' }, { name: 'Microsoft', sub: 'Dynamics 365', mark: 'squares' }, { name: 'HubSpot', sub: '', mark: 'sprocket' }],
          moreLabel: '+ More enterprise integrations', moreUrl: '',
        },
      },
      {
        type: 'EnterpriseBadges',
        props: {
          id: id('badges'), title: 'Enterprise-Grade Security & Compliance',
          items: [
            { icon: 'shield', title: 'SOC 2 Type II', text: 'Certified (sample)' },
            { icon: 'globe', title: 'ISO 27001', text: 'Compliant (sample)' },
            { icon: 'lock', title: 'Enterprise-Grade', text: 'Encryption (in transit & at rest)' },
            { icon: 'layers', title: 'GDPR & CCPA', text: 'Ready (sample)' },
          ],
          note: 'A secure, reliable platform built for global enterprises.',
        },
      },
      {
        type: 'EnterpriseTestimonials',
        props: {
          id: id('quotes'), title: 'What Our Customers Say',
          text: 'Enterprise teams use SmartVideo AI to create more meaningful engagement and measurable pipeline growth.',
          quotes: [
            { text: 'SmartVideo AI has become a core part of our outreach strategy. We’re seeing significantly higher engagement and more qualified meetings across our enterprise accounts.', name: 'Jennifer Carter', role: 'VP of Enterprise Sales, Oracle (sample)', avatar: '/landing-art/09/q1.webp' },
            { text: 'The ability to personalize video at scale—while keeping our brand and compliance standards intact—makes SmartVideo AI a perfect fit for our global sales organization.', name: 'Mark Delaney', role: 'Head of GTM Operations, Deloitte (sample)', avatar: '/landing-art/09/q2.webp' },
            { text: 'It’s easy for our teams to use, integrates seamlessly with our CRM, and has delivered a measurable lift in pipeline. A true enterprise solution.', name: 'Priya Menon', role: 'Chief Revenue Officer, Workday (sample)', avatar: '/landing-art/09/q3.webp' },
          ],
        },
      },
      {
        type: 'ContactBand',
        props: {
          id: id('contact'), eyebrow: "Let's talk", title: 'Ready to Scale Personalized Outreach?',
          text: 'Contact our team to learn how SmartVideo AI can help you drive more engagement, qualified leads, and revenue—at enterprise scale.',
          fields: [f('firstname', 'First Name *'), f('lastname', 'Last Name *'), f('email', 'Work Email *', 'email'), f('company', 'Company *'), f('message', 'How can we help? *', 'textarea')],
          submitLabel: 'Contact Us', successMessage: 'Thanks! Our team will be in touch shortly.',
        },
      },
    ],
    zones: {},
  },
};
