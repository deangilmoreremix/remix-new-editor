// Instructions & Tutorials - SmartVideo Integration
// Help content and tutorials for video personalization features

export const STUDIO_INSTRUCTIONS = {
  personalize: {
    id: 'personalize',
    title: 'Video Personalization Hub',
    quickTips: [
      'Choose between overlay personalization or AI-generated videos',
      'Import contacts via CSV for bulk personalization',
      'Use token replacement ({{firstName}}, {{company}}) for dynamic content',
      'Preview videos before generating to ensure quality'
    ],
    steps: [
      {
        title: 'Choose Creation Mode',
        content: 'Select between overlay-based personalization (faster) or AI-generated videos (more advanced).',
        tips: ['Overlay mode works with existing videos', 'AI mode creates videos from scratch']
      },
      {
        title: 'Import Contacts',
        content: 'Upload a CSV file with your contact data for personalization.',
        tips: ['Required columns: Email, First Name, Company', 'Optional: Website, Industry, Job Title']
      },
      {
        title: 'Configure Personalization',
        content: 'Set up tokens and templates for dynamic content replacement.',
        tips: ['Use {{firstName}} for personal greetings', 'Add {{company}} for business context']
      },
      {
        title: 'Generate Videos',
        content: 'Create personalized videos for each contact in your list.',
        tips: ['Monitor progress in real-time', 'Videos are processed in parallel for speed']
      }
    ]
  },

  'ai-video-creator': {
    id: 'ai-video-creator',
    title: 'AI Video Creator',
    quickTips: [
      'Write scripts with personalization tokens',
      'Choose avatars that match your brand',
      'Select voices for natural delivery',
      'Generate professional videos automatically'
    ],
    steps: [
      {
        title: 'Write Your Script',
        content: 'Create a personalized message using tokens like {{firstName}} and {{company}}.',
        tips: ['Use the template library for quick starts', 'Keep scripts under 200 words for best results']
      },
      {
        title: 'Select AI Avatar',
        content: 'Choose a professional presenter that represents your brand.',
        tips: ['Match avatar style to your industry', 'Consider your audience demographics']
      },
      {
        title: 'Choose Voice Style',
        content: 'Pick a voice that matches your message and brand personality.',
        tips: ['Test different voices for tone', 'Professional voices work for B2B content']
      },
      {
        title: 'Generate AI Video',
        content: 'Let AI create professional videos with perfect lip-sync.',
        tips: ['Generation takes 2-5 minutes per video', 'Monitor progress in the interface']
      }
    ]
  },

  'contact-importer': {
    id: 'contact-importer',
    title: 'Contact Importer',
    quickTips: [
      'CSV format with headers in first row',
      'Map columns to contact fields',
      'Validate data before importing',
      'Supports up to 10,000 contacts'
    ],
    steps: [
      {
        title: 'Prepare CSV File',
        content: 'Create a CSV file with your contact information.',
        tips: ['Include Email as required field', 'Use consistent column names']
      },
      {
        title: 'Upload and Map',
        content: 'Upload your file and map CSV columns to contact fields.',
        tips: ['Auto-mapping detects common field names', 'Preview data before final import']
      },
      {
        title: 'Validate and Import',
        content: 'Review data quality and complete the import process.',
        tips: ['Check for duplicate emails', 'Validate required fields are present']
      }
    ]
  },

  'token-editor': {
    id: 'token-editor',
    title: 'Token Management',
    quickTips: [
      'System tokens are always available',
      'Create custom tokens for specific needs',
      'Use fallbacks for missing data',
      'Test tokens with sample data'
    ],
    steps: [
      {
        title: 'Use System Tokens',
        content: 'Leverage built-in tokens like {{firstName}}, {{company}}, {{email}}.',
        tips: ['System tokens work with all contact data', 'No configuration needed']
      },
      {
        title: 'Create Custom Tokens',
        content: 'Add custom tokens for specific personalization needs.',
        tips: ['Use descriptive names', 'Set appropriate fallback values']
      },
      {
        title: 'Configure Fallbacks',
        content: 'Define what to show when contact data is missing.',
        tips: ['Generic fallbacks maintain professionalism', 'Test with incomplete contact data']
      }
    ]
  },

  'video-uploader': {
    id: 'video-uploader',
    title: 'Video Upload',
    quickTips: [
      'Supported formats: MP4, MOV, AVI, WebM',
      'Maximum file size: 500MB',
      'Videos are processed for optimal quality',
      'Thumbnails generated automatically'
    ],
    steps: [
      {
        title: 'Select Video File',
        content: 'Choose a high-quality video file from your computer.',
        tips: ['Use horizontal videos for best results', 'Ensure good lighting and audio']
      },
      {
        title: 'Upload and Process',
        content: 'Upload file and wait for processing to complete.',
        tips: ['Larger files take longer to process', 'Check upload progress indicator']
      },
      {
        title: 'Review and Confirm',
        content: 'Verify video quality and metadata before using.',
        tips: ['Check video duration and resolution', 'Ensure audio is clear']
      }
    ]
  },

  'video-personalizer': {
    id: 'video-personalizer',
    title: 'Video Personalization',
    quickTips: [
      'Preview changes before generating',
      'Batch processing saves time',
      'Monitor progress in real-time',
      'Download individual or bulk videos'
    ],
    steps: [
      {
        title: 'Select Base Video',
        content: 'Choose the video template to personalize.',
        tips: ['Use videos with clear text overlays', 'High-quality videos produce better results']
      },
      {
        title: 'Configure Tokens',
        content: 'Set up token mappings for personalization.',
        tips: ['Match tokens to contact data fields', 'Use preview to test replacements']
      },
      {
        title: 'Generate Videos',
        content: 'Create personalized versions for each contact.',
        tips: ['Start with small batches for testing', 'Monitor system resources during processing']
      },
      {
        title: 'Download and Share',
        content: 'Access generated videos and sharing options.',
        tips: ['Videos include download links', 'Share directly from the platform']
      }
    ]
  }
};

export const COMMON_ISSUES = {
  'api-key-missing': {
    title: 'API Key Missing',
    description: 'The AI service requires an API key to generate videos.',
    solution: 'Get an API key from muapi.ai and enter it in the settings modal.',
    steps: [
      'Visit muapi.ai and create an account',
      'Generate an API key in your dashboard',
      'Enter the key in the application settings',
      'Test the key with a small generation'
    ]
  },

  'video-generation-failed': {
    title: 'Video Generation Failed',
    description: 'The AI video generation process encountered an error.',
    solution: 'Check your API key, internet connection, and try again.',
    steps: [
      'Verify API key is valid and has credits',
      'Check internet connection stability',
      'Try with shorter text or different avatar',
      'Contact support if issue persists'
    ]
  },

  'csv-import-error': {
    title: 'CSV Import Failed',
    description: 'The contact import process failed to read your CSV file.',
    solution: 'Check CSV format and try uploading again.',
    steps: [
      'Ensure first row contains column headers',
      'Check for special characters in CSV',
      'Verify file is not corrupted',
      'Use UTF-8 encoding for international characters'
    ]
  },

  'token-replacement-failed': {
    title: 'Token Replacement Issues',
    description: 'Some tokens are not being replaced in the final video.',
    solution: 'Check token syntax and contact data mapping.',
    steps: [
      'Verify token syntax (use {{tokenName}} format)',
      'Check that contact data includes required fields',
      'Test with sample data first',
      'Use fallback values for optional fields'
    ]
  },

  'video-quality-poor': {
    title: 'Poor Video Quality',
    description: 'Generated videos have lower quality than expected.',
    solution: 'Check source video quality and generation settings.',
    steps: [
      'Use high-resolution source videos',
      'Check internet connection during generation',
      'Try different AI models for better quality',
      'Ensure source video has clear text overlays'
    ]
  }
};

export const TUTORIALS = {
  'getting-started': {
    title: 'Getting Started with Video Personalization',
    duration: '5 minutes',
    steps: [
      'Choose your creation mode (overlay or AI)',
      'Import your contact list via CSV',
      'Set up personalization tokens',
      'Generate your first personalized video',
      'Download and share your results'
    ]
  },

  'ai-video-creation': {
    title: 'Creating AI-Generated Videos',
    duration: '8 minutes',
    steps: [
      'Write a compelling script with tokens',
      'Select an appropriate AI avatar',
      'Choose a matching voice style',
      'Configure video settings and quality',
      'Generate and download your AI video'
    ]
  },

  'bulk-processing': {
    title: 'Bulk Video Processing Best Practices',
    duration: '6 minutes',
    steps: [
      'Prepare your contact data carefully',
      'Test with small batches first',
      'Monitor processing progress',
      'Handle failed generations gracefully',
      'Optimize for large-scale campaigns'
    ]
  },

  'advanced-personalization': {
    title: 'Advanced Personalization Techniques',
    duration: '10 minutes',
    steps: [
      'Create custom token mappings',
      'Use conditional logic in scripts',
      'Leverage contact data for dynamic content',
      'Implement fallback strategies',
      'Test personalization with edge cases'
    ]
  }
};

export const FAQS = [
  {
    question: 'What\'s the difference between overlay and AI-generated videos?',
    answer: 'Overlay videos replace text in existing video templates, while AI-generated videos create entirely new videos from scripts using artificial intelligence, avatars, and voice synthesis.'
  },
  {
    question: 'How many contacts can I process at once?',
    answer: 'You can process up to 10,000 contacts in a single batch. For optimal performance, we recommend starting with smaller batches (100-500) for testing.'
  },
  {
    question: 'What video formats are supported?',
    answer: 'We support MP4, MOV, AVI, and WebM formats. For best results, use MP4 files with H.264 encoding and a resolution of at least 1080p.'
  },
  {
    question: 'Can I customize the AI avatars?',
    answer: 'Yes, you can choose from different avatar styles (professional, friendly, technical, etc.) and the AI will generate appropriate visuals for each style.'
  },
  {
    question: 'How long does video generation take?',
    answer: 'AI-generated videos typically take 2-5 minutes each. Overlay-based personalization is much faster, usually completing in under 30 seconds per video.'
  },
  {
    question: 'What languages are supported for voice synthesis?',
    answer: 'Our AI voice synthesis supports 40+ languages including English, Spanish, French, German, Chinese, Japanese, and many others.'
  },
  {
    question: 'Can I use my own voice for the videos?',
    answer: 'Currently, we use high-quality AI voice synthesis. Custom voice cloning may be available in future updates.'
  },
  {
    question: 'What\'s the maximum video length I can create?',
    answer: 'AI-generated videos can be up to 15 seconds long. For longer content, consider breaking it into multiple shorter videos.'
  },
  {
    question: 'Can I edit videos after generation?',
    answer: 'Yes, generated videos can be downloaded and edited in external video editing software. We also provide basic trimming and format conversion options.'
  },
  {
    question: 'Is my data secure and private?',
    answer: 'Yes, all data processing happens securely. Contact information and generated videos are encrypted and only accessible to you. We do not store your API keys.'
  }
];

// Helper functions
export function getInstructionsForStudio(studioId) {
  return STUDIO_INSTRUCTIONS[studioId] || null;
}

export function getHelpForIssue(issueId) {
  return COMMON_ISSUES[issueId] || null;
}

export function getTutorialById(tutorialId) {
  return TUTORIALS[tutorialId] || null;
}

export function searchFAQs(query) {
  const lowercaseQuery = query.toLowerCase();
  return FAQS.filter(faq =>
    faq.question.toLowerCase().includes(lowercaseQuery) ||
    faq.answer.toLowerCase().includes(lowercaseQuery)
  );
}

export function getAllTutorials() {
  return Object.values(TUTORIALS);
}

export function getAllFAQs() {
  return FAQS;
}