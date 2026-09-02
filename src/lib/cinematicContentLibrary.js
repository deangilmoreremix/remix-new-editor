/**
 * Cinematic content library for video sellers.
 *
 * Provides:
 * - videoRoles
 * - clientIndustries
 * - videoTypes
 * - visualStyles
 * - platforms
 * - lengthBuckets
 * - cinematicTones
 * - option getters
 * - generateCinematicPrompt()
 */

const VIDEO_ROLES = [
  { value: 'agency-owner', label: 'Video Agency Owner' },
  { value: 'freelance-videographer', label: 'Freelance Videographer' },
  { value: 'marketing-video-creator', label: 'Marketing Video Creator' },
  { value: 'social-video-specialist', label: 'Social Video Specialist' },
  { value: 'cinematic-director', label: 'Cinematic Commercial Director' },
];

const CLIENT_INDUSTRIES = [
  { value: 'saas', label: 'SaaS & Tech' },
  { value: 'fintech', label: 'FinTech' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'real-estate', label: 'Real Estate' },
  { value: 'education', label: 'Education' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'energy', label: 'Energy' },
  { value: 'government', label: 'Government' },
  { value: 'telecom', label: 'Telecommunications' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'construction', label: 'Construction' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'retail', label: 'Retail' },
  { value: 'fitness', label: 'Fitness & Wellness' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'fashion', label: 'Fashion & Lifestyle' },
  { value: 'events', label: 'Events & Entertainment' },
  { value: 'luxury', label: 'Luxury & Premium' },
  { value: 'travel', label: 'Travel & Hospitality' },
  { value: 'nonprofit', label: 'Nonprofit & Social Impact' },
];

const VIDEO_TYPES = [
  { value: 'brand-film', label: 'Brand Film' },
  { value: 'product-demo', label: 'Product Demo' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'explainer', label: 'Explainer' },
  { value: 'training-video', label: 'Training Video' },
  { value: 'event-recap', label: 'Event Recap' },
  { value: 'social-media-cut', label: 'Social Media Cut' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'documentary-style', label: 'Documentary Style' },
  { value: 'ceo-message', label: 'CEO Message' },
  { value: 'trade-show', label: 'Trade Show' },
  { value: 'launch-video', label: 'Launch Video' },
  { value: 'customer-story', label: 'Customer Story' },
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'internal-comms', label: 'Internal Comms' },
];

const VISUAL_STYLES = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'corporate-clean', label: 'Corporate Clean' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'animated-3d', label: 'Animated / 3D' },
  { value: 'live-action', label: 'Live-Action' },
  { value: 'mixed-media', label: 'Mixed Media' },
  { value: 'storyboard-style', label: 'Storyboard Style' },
  { value: 'user-generated', label: 'User-Generated' },
  { value: 'lo-fi-social', label: 'Lo-Fi Social' },
  { value: 'premium-commercial', label: 'Premium Commercial' },
];

const PLATFORMS = [
  { value: 'instagram-tiktok', label: 'Instagram / TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'website-hero', label: 'Website Hero' },
  { value: 'trade-show', label: 'Trade Show' },
  { value: 'email', label: 'Email' },
  { value: 'paid-ads', label: 'Paid Ads' },
  { value: 'tv-ctv', label: 'TV / CTV' },
];

const LENGTH_BUCKETS = [
  { value: '15s', label: '15 seconds' },
  { value: '30s', label: '30 seconds' },
  { value: '60s', label: '60 seconds' },
  { value: '90s', label: '90 seconds' },
  { value: '2-3min', label: '2-3 minutes' },
  { value: '5min-plus', label: '5+ minutes' },
];

const CINEMATIC_TONES = [
  { value: 'executive', label: 'Executive' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'educational', label: 'Educational' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'bold', label: 'Bold' },
  { value: 'calm', label: 'Calm' },
  { value: 'technical', label: 'Technical' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'humorous', label: 'Humorous' },
];

const COMPLIANCE_HINTS = {
  'healthcare': 'Keep visuals HIPAA-safe. Avoid identifiable patient imagery unless explicitly authorized. Use stock or stylized visuals where possible.',
  'financial-services': 'Use SEC-compliant claims. Avoid guaranteed-return language. Emphasize security, trust, and regulatory alignment.',
  'manufacturing': 'Emphasize industrial safety, operational realism, and precision. Show real processes, protective equipment, and clean facilities.',
  'government': 'Emphasize compliance, public service, and transparency. Avoid partisan framing. Show civic outcomes and public benefit.',
  'insurance': 'Emphasize risk mitigation, trust, and protection. Use calming, reassuring visuals. Avoid fear-mongering.',
};

function getIndustryHint(industry) {
  return COMPLIANCE_HINTS[industry] || '';
}

function buildCinematicPrompt(params = {}) {
  const {
    basePrompt = '',
    videoRole = '',
    clientIndustry = '',
    videoType = '',
    visualStyle = '',
    platform = '',
    length = '',
    tone = '',
  } = params;

  const parts = [];

  if (basePrompt.trim()) parts.push(basePrompt.trim());

  if (videoType) {
    const typeLabel = VIDEO_TYPES.find(v => v.value === videoType)?.label || videoType;
    parts.push(`Video type: ${typeLabel}`);
  }

  if (visualStyle) {
    const styleLabel = VISUAL_STYLES.find(v => v.value === visualStyle)?.label || visualStyle;
    parts.push(`Visual style: ${styleLabel}`);
  }

  if (platform) {
    const platformLabel = PLATFORMS.find(p => p.value === platform)?.label || platform;
    parts.push(`Platform: ${platformLabel}`);
  }

  if (length) {
    const lengthLabel = LENGTH_BUCKETS.find(l => l.value === length)?.label || length;
    parts.push(`Length: ${lengthLabel}`);
  }

  if (tone) {
    const toneLabel = CINEMATIC_TONES.find(t => t.value === tone)?.label || tone;
    parts.push(`Tone: ${toneLabel}`);
  }

  if (clientIndustry) {
    const industryLabel = CLIENT_INDUSTRIES.find(i => i.value === clientIndustry)?.label || clientIndustry;
    parts.push(`Client industry: ${industryLabel}`);
    const hint = getIndustryHint(clientIndustry);
    if (hint) parts.push(`Compliance note: ${hint}`);
  }

  if (videoRole) {
    const roleLabel = VIDEO_ROLES.find(r => r.value === videoRole)?.label || videoRole;
    parts.push(`Creator role: ${roleLabel}`);
  }

  return parts.join('\n');
}

export const cinematicContentLibrary = {
  videoRoles: VIDEO_ROLES,
  clientIndustries: CLIENT_INDUSTRIES,
  videoTypes: VIDEO_TYPES,
  visualStyles: VISUAL_STYLES,
  platforms: PLATFORMS,
  lengthBuckets: LENGTH_BUCKETS,
  cinematicTones: CINEMATIC_TONES,
  getVideoRoleOptions: () => VIDEO_ROLES,
  getClientIndustryOptions: () => CLIENT_INDUSTRIES,
  getVideoTypeOptions: () => VIDEO_TYPES,
  getVisualStyleOptions: () => VISUAL_STYLES,
  getPlatformOptions: () => PLATFORMS,
  getLengthBucketOptions: () => LENGTH_BUCKETS,
  getCinematicToneOptions: () => CINEMATIC_TONES,
  getIndustryHint,
  generateCinematicPrompt: buildCinematicPrompt,
};

export default cinematicContentLibrary;
