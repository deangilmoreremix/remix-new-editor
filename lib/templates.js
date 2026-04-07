// Template System - Open-Higgsfield-AI Integration
// Pre-built templates for AI video generation and personalization

export const SCRIPT_TEMPLATES = [
  {
    id: 'sales-introduction',
    name: 'Sales Introduction',
    category: 'sales',
    description: 'Professional introduction for sales outreach',
    script: `Hi {{firstName}},

I'm {{myName}} from {{myCompany}}. I wanted to personally reach out about our solution that helps companies like {{company}} increase productivity by 40%.

Would you be available for a quick 15-minute call next week to discuss how we can help {{company}} achieve similar results?

Best regards,
{{myName}}`,
    tokens: ['{{firstName}}', '{{myName}}', '{{myCompany}}', '{{company}}'],
    avatarType: 'professional-male',
    voiceType: 'professional-male'
  },
  {
    id: 'follow-up-email',
    name: 'Follow-up Email',
    category: 'sales',
    description: 'Professional follow-up communication',
    script: `Hi {{firstName}},

I wanted to follow up on my previous message about our services. I noticed {{company}} is doing great work in {{industry}}.

Our clients typically see a 30% improvement in their key metrics within the first 3 months. I'd love to show you how this could work for {{company}}.

Are you available for a brief call?

Best,
{{myName}}`,
    tokens: ['{{firstName}}', '{{company}}', '{{industry}}', '{{myName}}'],
    avatarType: 'professional-male',
    voiceType: 'professional-male'
  },
  {
    id: 'personalized-outreach',
    name: 'Personalized Outreach',
    category: 'sales',
    description: 'Highly personalized prospecting message',
    script: `Hello {{firstName}},

I came across {{company}} and was impressed by your work in {{industry}}. As {{myTitle}} at {{myCompany}}, I understand the challenges you face.

We've helped similar companies overcome these challenges and achieve remarkable results. I'd be interested in learning more about {{company}}'s goals.

Would you have 10 minutes to chat?

Warm regards,
{{myName}}`,
    tokens: ['{{firstName}}', '{{company}}', '{{industry}}', '{{myTitle}}', '{{myCompany}}', '{{myName}}'],
    avatarType: 'professional-male',
    voiceType: 'professional-male'
  },
  {
    id: 'product-demo',
    name: 'Product Demo',
    category: 'marketing',
    description: 'Product demonstration and walkthrough',
    script: `Hi {{firstName}},

I'd like to show you how our platform can transform the way {{company}} handles {{industry}} challenges.

In this quick demo, you'll see:
- How we streamline your workflow
- Real-time analytics and insights
- Integration with your existing tools

Would you like me to walk you through a personalized demo?

Best,
{{myName}}
{{myCompany}}`,
    tokens: ['{{firstName}}', '{{company}}', '{{industry}}', '{{myName}}', '{{myCompany}}'],
    avatarType: 'friendly-male',
    voiceType: 'friendly-male'
  },
  {
    id: 'customer-success',
    name: 'Customer Success Check-in',
    category: 'support',
    description: 'Customer success and support outreach',
    script: `Hello {{firstName}},

I hope this message finds you well. I wanted to check in and see how things are going at {{company}}.

We've helped many {{industry}} companies achieve their goals, and I'm here to ensure you have everything you need to succeed.

Is there anything specific I can help you with today?

Warm regards,
{{myName}}
Customer Success Manager
{{myCompany}}`,
    tokens: ['{{firstName}}', '{{company}}', '{{industry}}', '{{myName}}', '{{myCompany}}'],
    avatarType: 'friendly-female',
    voiceType: 'friendly-female'
  },
  {
    id: 'event-invitation',
    name: 'Event Invitation',
    category: 'marketing',
    description: 'Event or webinar invitation',
    script: `Hi {{firstName}},

I'm excited to invite you to our upcoming webinar: "Transforming {{industry}} in 2024".

This exclusive session will cover:
- Latest industry trends and insights
- Real case studies from companies like {{company}}
- Actionable strategies you can implement immediately

Date: Next Tuesday at 2 PM EST
Duration: 45 minutes

Would you like to reserve your spot?

Best regards,
{{myName}}
{{myCompany}} Events`,
    tokens: ['{{firstName}}', '{{industry}}', '{{company}}', '{{myName}}', '{{myCompany}}'],
    avatarType: 'enthusiastic-male',
    voiceType: 'enthusiastic-male'
  },
  {
    id: 'thank-you-note',
    name: 'Thank You Note',
    category: 'relationship',
    description: 'Gratitude and relationship building',
    script: `Dear {{firstName}},

I wanted to take a moment to thank you for your time and consideration. It's been a pleasure learning about {{company}} and your impressive work in {{industry}}.

We truly believe our solutions can help companies like yours achieve even greater success. Whether or not we work together, I wish you continued success.

Please don't hesitate to reach out if you need anything.

Warm regards,
{{myName}}
{{myCompany}}`,
    tokens: ['{{firstName}}', '{{company}}', '{{industry}}', '{{myName}}', '{{myCompany}}'],
    avatarType: 'professional-female',
    voiceType: 'professional-female'
  }
];

export const AVATAR_TEMPLATES = [
  {
    id: 'professional-male',
    name: 'Professional Male',
    description: 'Corporate executive, CEO, manager',
    gender: 'male',
    style: 'professional',
    prompt: 'Professional headshot portrait of a confident business executive, clean background, corporate attire, photorealistic, high quality'
  },
  {
    id: 'professional-female',
    name: 'Professional Female',
    description: 'Business leader, consultant, director',
    gender: 'female',
    style: 'professional',
    prompt: 'Professional headshot portrait of a successful business woman, clean background, corporate attire, photorealistic, high quality'
  },
  {
    id: 'friendly-male',
    name: 'Friendly Male',
    description: 'Sales rep, customer service, trainer',
    gender: 'male',
    style: 'friendly',
    prompt: 'Friendly headshot portrait of a approachable sales professional, warm smile, clean background, business casual, photorealistic'
  },
  {
    id: 'friendly-female',
    name: 'Friendly Female',
    description: 'Marketing, HR, community manager',
    gender: 'female',
    style: 'friendly',
    prompt: 'Warm and approachable headshot portrait of a marketing professional, genuine smile, clean background, business casual, photorealistic'
  },
  {
    id: 'tech-professional',
    name: 'Tech Professional',
    description: 'Developer, engineer, analyst',
    gender: 'male',
    style: 'technical',
    prompt: 'Tech professional headshot, glasses, thoughtful expression, clean background, smart casual attire, photorealistic'
  },
  {
    id: 'healthcare-professional',
    name: 'Healthcare Professional',
    description: 'Doctor, nurse, healthcare worker',
    gender: 'female',
    style: 'professional',
    prompt: 'Healthcare professional headshot, compassionate expression, medical scrubs or professional attire, clean background, photorealistic'
  },
  {
    id: 'educator',
    name: 'Educator',
    description: 'Teacher, professor, trainer',
    gender: 'female',
    style: 'approachable',
    prompt: 'Educator headshot, warm and knowledgeable expression, clean background, professional attire, photorealistic'
  },
  {
    id: 'enthusiastic-male',
    name: 'Enthusiastic Male',
    description: 'Motivational speaker, coach',
    gender: 'male',
    style: 'energetic',
    prompt: 'Enthusiastic professional headshot, energetic expression, clean background, business attire, photorealistic'
  }
];

export const STYLE_TEMPLATES = [
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional corporate environment',
    prompt: 'Modern corporate office background, clean and professional, glass walls, city view, warm lighting'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple background',
    prompt: 'Minimalist background, solid color, clean and professional, soft lighting'
  },
  {
    id: 'warm',
    name: 'Warm & Welcoming',
    description: 'Friendly and approachable setting',
    prompt: 'Warm and inviting background, soft colors, comfortable lighting, professional yet friendly atmosphere'
  },
  {
    id: 'tech',
    name: 'Tech/Modern',
    description: 'Modern technology focused',
    prompt: 'Modern tech office background, monitors, plants, clean lines, contemporary design'
  }
];

export const VIDEO_STYLE_TEMPLATES = [
  {
    id: 'talking-head',
    name: 'Talking Head',
    description: 'Traditional video with presenter',
    prompt: 'Professional talking head video, presenter speaking directly to camera, clean background'
  },
  {
    id: 'presentation',
    name: 'Presentation Style',
    description: 'Presenter with slides or graphics',
    prompt: 'Professional presentation video, presenter speaking with visual aids, engaging delivery'
  },
  {
    id: 'conversational',
    name: 'Conversational',
    description: 'Friendly one-on-one conversation',
    prompt: 'Conversational video style, friendly and approachable, like speaking with a colleague'
  },
  {
    id: 'motivational',
    name: 'Motivational',
    description: 'Inspiring and energetic delivery',
    prompt: 'Motivational speaking style, enthusiastic delivery, inspiring and energetic presentation'
  }
];

// Helper functions for template management
export function getScriptTemplatesByCategory(category) {
  return SCRIPT_TEMPLATES.filter(template => template.category === category);
}

export function getTemplateById(id) {
  return SCRIPT_TEMPLATES.find(template => template.id === id);
}

export function getAvatarById(id) {
  return AVATAR_TEMPLATES.find(avatar => avatar.id === id);
}

export function getStyleById(id) {
  return STYLE_TEMPLATES.find(style => style.id === id);
}

export function getVideoStyleById(id) {
  return VIDEO_STYLE_TEMPLATES.find(style => style.id === id);
}

export function getAllCategories() {
  const categories = [...new Set(SCRIPT_TEMPLATES.map(t => t.category))];
  return categories.map(category => ({
    id: category,
    name: category.charAt(0).toUpperCase() + category.slice(1),
    templates: getScriptTemplatesByCategory(category)
  }));
}

export function createCustomTemplate(baseTemplate, customizations) {
  return {
    ...baseTemplate,
    ...customizations,
    id: `custom-${Date.now()}`,
    isCustom: true
  };
}

// Default template selections
export const DEFAULT_TEMPLATES = {
  script: 'sales-introduction',
  avatar: 'professional-male',
  style: 'corporate',
  videoStyle: 'talking-head'
};