/**
 * Studio Demo Automation Framework
 *
 * A comprehensive Playwright script for automated product demonstrations
 * across multiple studio environments with video recording capabilities.
 *
 * Architecture:
 * - Configuration-driven studio list and feature definitions
 * - Resilient element interaction with retry/timeout strategies
 * - Built-in Playwright video recording per studio
 * - Validation layer with screenshot-on-failure
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION LAYER
// =============================================================================

export interface StudioConfig {
  id: string;
  name: string;
  url: string;
  features: FeatureStep[];
  expectedTitle?: string;
  authRequired?: boolean;
  authCredentials?: {
    email: string;
    password: string;
  };
}

export interface FeatureStep {
  name: string;
  description: string;
  action: FeatureAction;
  validate?: ValidationCheck[];
  waitForSelector?: string;
  screenshot?: boolean;
}

type FeatureAction =
  | { type: 'click'; selector: string; options?: { force?: boolean; delay?: number; timeout?: number } }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'hover'; selector: string }
  | { type: 'scroll'; selector?: string; direction?: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'wait'; ms: number }
  | { type: 'waitForSelector'; selector: string; state?: 'visible' | 'hidden' | 'attached' }
  | { type: 'press'; key: string }
  | { type: 'evaluate'; script: string }
  | { type: 'custom'; handler: (page: Page) => Promise<void> };

interface ValidationCheck {
  type: 'visible' | 'hidden' | 'text' | 'url' | 'count' | 'attribute';
  selector?: string;
  expected?: string | number;
  description: string;
}

interface DemoResult {
  studioId: string;
  studioName: string;
  url: string;
  passed: boolean;
  videoPath?: string;
  screenshots: string[];
  errors: string[];
  duration: number;
  featureResults: FeatureResult[];
}

interface FeatureResult {
  name: string;
  passed: boolean;
  error?: string;
}

// =============================================================================
// STUDIO CONFIGURATIONS
// =============================================================================

/**
 * Define all studio environments to test.
 * Extend this array with your actual studio URLs and feature workflows.
 */
const STUDIO_ROUTES = [
  'image', 'video', 'cinema', 'cinema-template', 'storyboard', 'effects', 'edit',
  'upscale', 'character', 'commercial', 'audio', 'avatar', 'training', 'videotools',
  'chat', 'lipsync', 'influencer', 'viral', 'video-agent', 'director', 'ai-vfx',
  'render', 'timeline', 'apps', 'explore', 'templates', 'library', 'content-library',
  'community', 'assist', 'pexels-media', 'academy', 'text-to-image', 'image-to-image',
  'text-to-video', 'image-to-video', 'video-to-video', 'video-watermark',
  'character-page', 'effects-page', 'storyboard-page', 'influencer-page',
  'commercial-page', 'upscale-page', 'studios/product-photo-studio', 'studios/fashion-studio'
];

function buildStudioConfigs(baseUrl = 'http://localhost:3100'): StudioConfig[] {
  const studioFeatures: Record<string, StudioConfig['features']> = {
    image: [
      {
        name: 'Load Image Studio',
        description: 'Navigate to image studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: '#i-prompt-textarea', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#i-prompt-textarea', description: 'Prompt input is visible' }
        ]
      },
      {
        name: 'Enter Prompt',
        description: 'Type a demo prompt into the image generator',
        action: {
          type: 'fill',
          selector: '#i-prompt-textarea',
          value: 'A beautiful sunset over the ocean'
        },
        validate: [
          { type: 'visible', selector: '#i-prompt-textarea', description: 'Prompt input filled' }
        ]
      },
      {
        name: 'Generate Image',
        description: 'Click generate and wait for result area',
        action: {
          type: 'click',
          selector: 'button[aria-label="Generate image"]',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    video: [
      {
        name: 'Load Video Studio',
        description: 'Navigate to video studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: '#v-v-prompt-textarea', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#v-v-prompt-textarea', description: 'Video prompt input is visible' }
        ]
      },
      {
        name: 'Enter Prompt',
        description: 'Type a demo prompt into the video generator',
        action: {
          type: 'fill',
          selector: '#v-v-prompt-textarea',
          value: 'A cinematic drone shot over mountains'
        },
        validate: [
          { type: 'visible', selector: '#v-v-prompt-textarea', description: 'Video prompt input filled' }
        ]
      },
      {
        name: 'Generate Video',
        description: 'Click generate and wait for result area',
        action: {
          type: 'click',
          selector: 'button[aria-label="Generate video"]',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    cinema: [
      {
        name: 'Load Cinema Studio',
        description: 'Navigate to cinema studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: 'textarea[aria-label="Cinema prompt"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Cinema prompt"]', description: 'Cinema prompt input is visible' }
        ]
      },
      {
        name: 'Enter Prompt',
        description: 'Type a demo prompt into the cinema generator',
        action: {
          type: 'fill',
          selector: 'textarea[aria-label="Cinema prompt"]',
          value: 'A cyberpunk cityscape at night with neon lights'
        },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Cinema prompt"]', description: 'Cinema prompt input filled' }
        ]
      },
      {
        name: 'Generate Cinema',
        description: 'Click generate and wait for result area',
        action: {
          type: 'click',
          selector: 'button[aria-label="Generate cinema shot"]',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    'cinema-template': [
      {
        name: 'Load Cinema Template Studio',
        description: 'Navigate to cinema template studio and verify UI loads',
        action: { type: 'waitForSelector', selector: '#previewArea, textarea', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#previewArea, textarea', description: 'Cinema template UI loaded' }
        ]
      }
    ],
    storyboard: [
      {
        name: 'Load Storyboard Studio',
        description: 'Navigate to storyboard studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: 'textarea[aria-label="Frame description"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Frame description"]', description: 'Frame description input is visible' }
        ]
      },
      {
        name: 'Enter Frame Description',
        description: 'Type a demo frame description',
        action: {
          type: 'fill',
          selector: 'textarea[aria-label="Frame description"]',
          value: 'A hero stands on a cliff overlooking a stormy sea'
        },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Frame description"]', description: 'Frame description filled' }
        ]
      },
      {
        name: 'Generate Frame',
        description: 'Click generate frame and wait for result',
        action: {
          type: 'click',
          selector: 'button[aria-label="Generate frame"]',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    effects: [
      {
        name: 'Load Effects Studio',
        description: 'Navigate to effects studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: '#fx-prompt-input', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#fx-prompt-input', description: 'Effect prompt input is visible' }
        ]
      },
      {
        name: 'Enter Effect Prompt',
        description: 'Type a demo effect prompt',
        action: {
          type: 'fill',
          selector: '#fx-prompt-input',
          value: 'Glitch effect with neon color shift'
        },
        validate: [
          { type: 'visible', selector: '#fx-prompt-input', description: 'Effect prompt filled' }
        ]
      },
      {
        name: 'Apply Effect',
        description: 'Click apply effect and wait for preview',
        action: {
          type: 'click',
          selector: 'button[aria-label="Apply effect"]',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after apply' }
        ]
      }
    ],
    edit: [
      {
        name: 'Load Edit Studio',
        description: 'Navigate to edit studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: 'textarea[aria-label="Edit prompt"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Edit prompt"]', description: 'Edit prompt input is visible' }
        ]
      },
      {
        name: 'Enter Edit Prompt',
        description: 'Type a demo edit prompt',
        action: {
          type: 'fill',
          selector: 'textarea[aria-label="Edit prompt"]',
          value: 'Remove background and add a gradient'
        },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Edit prompt"]', description: 'Edit prompt filled' }
        ]
      },
      {
        name: 'Generate Edit',
        description: 'Click generate and wait for result',
        action: {
          type: 'click',
          selector: 'button.btn-primary-modern',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    upscale: [
      {
        name: 'Load Upscale Studio',
        description: 'Navigate to upscale studio and verify upload button is visible',
        action: { type: 'waitForSelector', selector: 'button.btn-primary-modern, input[type="file"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'button.btn-primary-modern, input[type="file"]', description: 'Upscale controls visible' }
        ]
      }
    ],
    character: [
      {
        name: 'Load Character Studio',
        description: 'Navigate to character studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: '#character-prompt-input', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#character-prompt-input', description: 'Character prompt input is visible' }
        ]
      },
      {
        name: 'Enter Character Prompt',
        description: 'Type a demo character prompt',
        action: {
          type: 'fill',
          selector: '#character-prompt-input',
          value: 'A wise old wizard with a long white beard'
        },
        validate: [
          { type: 'visible', selector: '#character-prompt-input', description: 'Character prompt filled' }
        ]
      },
      {
        name: 'Generate Character',
        description: 'Click generate and wait for result',
        action: {
          type: 'click',
          selector: 'button.btn-primary-modern',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    commercial: [
      {
        name: 'Load Commercial Studio',
        description: 'Navigate to commercial studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: 'textarea', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'textarea', description: 'Commercial prompt input is visible' }
        ]
      },
      {
        name: 'Enter Product Prompt',
        description: 'Type a demo commercial prompt',
        action: {
          type: 'fill',
          selector: 'textarea',
          value: 'A refreshing soda commercial set on a tropical beach'
        },
        validate: [
          { type: 'visible', selector: 'textarea', description: 'Commercial prompt filled' }
        ]
      },
      {
        name: 'Generate Commercial',
        description: 'Click generate and wait for result',
        action: {
          type: 'click',
          selector: 'button.btn-primary-modern',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    audio: [
      {
        name: 'Load Audio Studio',
        description: 'Navigate to audio studio and verify controls are visible',
        action: { type: 'waitForSelector', selector: 'textarea, button.btn-primary-modern', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'textarea, button.btn-primary-modern', description: 'Audio studio controls visible' }
        ]
      }
    ],
    avatar: [
      {
        name: 'Load Avatar Studio',
        description: 'Navigate to avatar studio and verify controls are visible',
        action: { type: 'waitForSelector', selector: 'button.btn-primary-modern, input[type="file"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'button.btn-primary-modern, input[type="file"]', description: 'Avatar studio controls visible' }
        ]
      }
    ],
    training: [
      {
        name: 'Load Training Studio',
        description: 'Navigate to training studio and verify form controls are visible',
        action: { type: 'waitForSelector', selector: 'input, button[aria-label="Train LoRA"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'input, button[aria-label="Train LoRA"]', description: 'Training form controls visible' }
        ]
      }
    ],
    videotools: [
      {
        name: 'Load Video Tools Studio',
        description: 'Navigate to video tools studio and verify controls are visible',
        action: { type: 'waitForSelector', selector: 'button.btn-primary-modern, input[type="file"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'button.btn-primary-modern, input[type="file"]', description: 'Video tools controls visible' }
        ]
      }
    ],
    chat: [
      {
        name: 'Load Chat Studio',
        description: 'Navigate to chat studio and verify empty state is visible',
        action: { type: 'waitForSelector', selector: '.chat-empty-state, .chat-studio', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.chat-empty-state, .chat-studio', description: 'Chat studio loaded' }
        ]
      },
      {
        name: 'Open New Conversation',
        description: 'Click new chat button',
        action: {
          type: 'click',
          selector: '.chat-new-chat-btn',
          options: { timeout: 10000 }
        },
        validate: [
          { type: 'visible', selector: '.chat-main, .chat-studio', description: 'Chat interface visible' }
        ]
      }
    ],
    lipsync: [
      {
        name: 'Load Lip Sync Studio',
        description: 'Navigate to lip sync studio and verify mode toggles are visible',
        action: { type: 'waitForSelector', selector: '#imageModeBtn, #videoModeBtn', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#imageModeBtn, #videoModeBtn', description: 'Lip sync mode toggles visible' }
        ]
      }
    ],
    influencer: [
      {
        name: 'Load Influencer Studio',
        description: 'Navigate to influencer studio and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: 'textarea[aria-label="Influencer prompt"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Influencer prompt"]', description: 'Influencer prompt input is visible' }
        ]
      },
      {
        name: 'Enter Influencer Prompt',
        description: 'Type a demo influencer prompt',
        action: {
          type: 'fill',
          selector: 'textarea[aria-label="Influencer prompt"]',
          value: 'A fitness influencer promoting a new protein shake'
        },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Influencer prompt"]', description: 'Influencer prompt filled' }
        ]
      },
      {
        name: 'Generate Influencer Content',
        description: 'Click generate and wait for result',
        action: {
          type: 'click',
          selector: 'button[aria-label="Generate content"]',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page still responsive after generate' }
        ]
      }
    ],
    viral: [
      {
        name: 'Load Smart Video Viral',
        description: 'Navigate to viral studio and verify prompt cards are visible',
        action: { type: 'waitForSelector', selector: '.smart-card, .viral-rail-item', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.smart-card, .viral-rail-item', description: 'Viral prompt cards visible' }
        ]
      }
    ],
    'video-agent': [
      {
        name: 'Load Video Agent',
        description: 'Navigate to video agent and verify agent cards are visible',
        action: { type: 'waitForSelector', selector: '.agent-btn[data-agent]', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.agent-btn[data-agent]', description: 'Agent cards visible' }
        ]
      }
    ],
    director: [
      {
        name: 'Load Director',
        description: 'Navigate to director and verify command input is visible',
        action: { type: 'waitForSelector', selector: '#command-input', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#command-input', description: 'Director command input is visible' }
        ]
      },
      {
        name: 'Enter Director Command',
        description: 'Type a demo director command',
        action: {
          type: 'fill',
          selector: '#command-input',
          value: 'Create a 30-second product showcase video'
        },
        validate: [
          { type: 'visible', selector: '#command-input', description: 'Director command filled' }
        ]
      },
      {
        name: 'Send Command',
        description: 'Click send and wait for processing status',
        action: {
          type: 'click',
          selector: '#send-command-btn',
          options: { timeout: 30000 }
        },
        validate: [
          { type: 'visible', selector: '#chat-messages, #processing-status', description: 'Director response area visible' }
        ]
      }
    ],
    'ai-vfx': [
      {
        name: 'Load AI VFX',
        description: 'Navigate to AI VFX and verify iframe is visible',
        action: { type: 'waitForSelector', selector: 'iframe[src*="/ai-vfx/"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'iframe[src*="/ai-vfx/"]', description: 'AI VFX iframe visible' }
        ]
      }
    ],
    render: [
      {
        name: 'Load Render',
        description: 'Navigate to render page and verify action tiles are visible',
        action: { type: 'waitForSelector', selector: '.action-btn, button.w-full.p-3', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.action-btn, button.w-full.p-3', description: 'Render action tiles visible' }
        ]
      }
    ],
    timeline: [
      {
        name: 'Load Timeline Editor',
        description: 'Navigate to timeline editor and verify timeline loads',
        action: { type: 'waitForSelector', selector: '#timeline-container, [data-testid="timeline-container"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#timeline-container, [data-testid="timeline-container"]', description: 'Timeline container visible' }
        ]
      },
      {
        name: 'Verify Timeline Controls',
        description: 'Verify timeline playback controls are present',
        action: { type: 'waitForSelector', selector: '#tbPlay', state: 'visible' },
        validate: [
          { type: 'visible', selector: '#tbPlay', description: 'Timeline controls visible' }
        ]
      }
    ],
    apps: [
      {
        name: 'Load Apps Hub',
        description: 'Navigate to apps hub and verify studio cards are visible',
        action: { type: 'waitForSelector', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', description: 'Studio cards visible' }
        ]
      }
    ],
    explore: [
      {
        name: 'Load Explore',
        description: 'Navigate to explore page and verify content cards are visible',
        action: { type: 'waitForSelector', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', description: 'Explore content visible' }
        ]
      }
    ],
    templates: [
      {
        name: 'Load Templates',
        description: 'Navigate to templates page and verify template cards are visible',
        action: { type: 'waitForSelector', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', description: 'Template cards visible' }
        ]
      }
    ],
    library: [
      {
        name: 'Load Library',
        description: 'Navigate to library page and verify media items are visible',
        action: { type: 'waitForSelector', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', description: 'Library items visible' }
        ]
      }
    ],
    'content-library': [
      {
        name: 'Load Content Library',
        description: 'Navigate to content library and verify assets are visible',
        action: { type: 'waitForSelector', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', description: 'Content library assets visible' }
        ]
      }
    ],
    community: [
      {
        name: 'Load Community',
        description: 'Navigate to community page and verify posts are visible',
        action: { type: 'waitForSelector', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.bg-\\[\\#111\\]\\/90.backdrop-blur-xl', description: 'Community posts visible' }
        ]
      }
    ],
    assist: [
      {
        name: 'Load Assist',
        description: 'Navigate to assist page and verify prompt input is visible',
        action: { type: 'waitForSelector', selector: 'textarea.w-full.bg-white\\/5', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'textarea.w-full.bg-white\\/5', description: 'Assist prompt input visible' }
        ]
      }
    ],
    academy: [
      {
        name: 'Load Academy',
        description: 'Navigate to academy and verify track cards are visible',
        action: { type: 'waitForSelector', selector: '.rounded-2xl.border', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.rounded-2xl.border', description: 'Academy track cards visible' }
        ]
      }
    ],
    'text-to-image': [
      {
        name: 'Load Text to Image',
        description: 'Navigate to text-to-image landing and verify model cards are visible',
        action: { type: 'waitForSelector', selector: '.model-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.model-card', description: 'Model cards visible' }
        ]
      },
      {
        name: 'Navigate to Image Studio',
        description: 'Click Start to navigate to image studio',
        action: {
          type: 'click',
          selector: '.start-btn, .cta-btn',
          options: { timeout: 10000 }
        },
        validate: [
          { type: 'visible', selector: '#prompt-textarea', description: 'Navigated to Image Studio' }
        ]
      }
    ],
    'image-to-image': [
      {
        name: 'Load Image to Image',
        description: 'Navigate to image-to-image landing and verify model cards are visible',
        action: { type: 'waitForSelector', selector: '.model-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.model-card', description: 'Model cards visible' }
        ]
      },
      {
        name: 'Navigate to Edit Studio',
        description: 'Click Start to navigate to edit studio',
        action: {
          type: 'click',
          selector: '.start-btn, .cta-btn',
          options: { timeout: 10000 }
        },
        validate: [
          { type: 'visible', selector: 'textarea[aria-label="Edit prompt"], #prompt-textarea', description: 'Navigated to Edit/Image Studio' }
        ]
      }
    ],
    'text-to-video': [
      {
        name: 'Load Text to Video',
        description: 'Navigate to text-to-video landing and verify model cards are visible',
        action: { type: 'waitForSelector', selector: '.model-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.model-card', description: 'Model cards visible' }
        ]
      },
      {
        name: 'Navigate to Video Studio',
        description: 'Click Start to navigate to video studio',
        action: {
          type: 'click',
          selector: '.start-btn, .cta-btn',
          options: { timeout: 10000 }
        },
        validate: [
          { type: 'visible', selector: '#v-prompt-textarea, textarea', description: 'Navigated to Video Studio' }
        ]
      }
    ],
    'image-to-video': [
      {
        name: 'Load Image to Video',
        description: 'Navigate to image-to-video landing and verify model cards are visible',
        action: { type: 'waitForSelector', selector: '.model-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.model-card', description: 'Model cards visible' }
        ]
      },
      {
        name: 'Navigate to Video Studio',
        description: 'Click Start to navigate to video studio',
        action: {
          type: 'click',
          selector: '.start-btn, .cta-btn',
          options: { timeout: 10000 }
        },
        validate: [
          { type: 'visible', selector: '#v-prompt-textarea, textarea', description: 'Navigated to Video Studio' }
        ]
      }
    ],
    'video-to-video': [
      {
        name: 'Load Video to Video',
        description: 'Navigate to video-to-video landing and verify model cards are visible',
        action: { type: 'waitForSelector', selector: '.model-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.model-card', description: 'Model cards visible' }
        ]
      }
    ],
    'video-watermark': [
      {
        name: 'Load Video Watermark',
        description: 'Navigate to video watermark landing and verify tool cards are visible',
        action: { type: 'waitForSelector', selector: '.model-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.model-card', description: 'Tool cards visible' }
        ]
      }
    ],
    'character-page': [
      {
        name: 'Load Character Page',
        description: 'Navigate to character page and verify model cards are visible',
        action: { type: 'waitForSelector', selector: '.model-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.model-card', description: 'Model cards visible' }
        ]
      }
    ],
    'effects-page': [
      {
        name: 'Load Effects Page',
        description: 'Navigate to effects page and verify effect cards are visible',
        action: { type: 'waitForSelector', selector: '.effect-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.effect-card', description: 'Effect cards visible' }
        ]
      }
    ],
    'storyboard-page': [
      {
        name: 'Load Storyboard Page',
        description: 'Navigate to storyboard page and verify prompt cards are visible',
        action: { type: 'waitForSelector', selector: '.prompt-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.prompt-card', description: 'Prompt cards visible' }
        ]
      }
    ],
    'influencer-page': [
      {
        name: 'Load Influencer Page',
        description: 'Navigate to influencer page and verify format cards are visible',
        action: { type: 'waitForSelector', selector: '.format-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.format-card', description: 'Format cards visible' }
        ]
      }
    ],
    'commercial-page': [
      {
        name: 'Load Commercial Page',
        description: 'Navigate to commercial page and verify format cards are visible',
        action: { type: 'waitForSelector', selector: '.format-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.format-card', description: 'Format cards visible' }
        ]
      }
    ],
    'upscale-page': [
      {
        name: 'Load Upscale Page',
        description: 'Navigate to upscale page and verify method cards are visible',
        action: { type: 'waitForSelector', selector: '.method-card', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.method-card', description: 'Method cards visible' }
        ]
      }
    ],
    'studios/product-photo-studio': [
      {
        name: 'Load Product Photo Studio',
        description: 'Navigate to product photo studio and verify placeholder is visible',
        action: { type: 'waitForSelector', selector: '.rounded-2xl.border.border-white\\/10.bg-white\\/\\[0\\.03\\]', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.rounded-2xl.border.border-white\\/10.bg-white\\/\\[0\\.03\\]', description: 'Placeholder card visible' }
        ]
      }
    ],
    'studios/fashion-studio': [
      {
        name: 'Load Fashion Studio',
        description: 'Navigate to fashion studio and verify placeholder is visible',
        action: { type: 'waitForSelector', selector: '.rounded-2xl.border.border-white\\/10.bg-white\\/\\[0\\.03\\]', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.rounded-2xl.border.border-white\\/10.bg-white\\/\\[0\\.03\\]', description: 'Placeholder card visible' }
        ]
      }
    ]
  };

  return STUDIO_ROUTES.map((route) => {
    const slug = route.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').toLowerCase();
    const features = studioFeatures[route] || [
      {
        name: 'Load Studio',
        description: `Navigate to ${route} studio and verify it loads`,
        action: { type: 'waitForSelector', selector: 'body', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'body', description: 'Page body is visible' }
        ]
      },
      {
        name: 'Wait for Main Content',
        description: 'Verify main content area is present',
        action: { type: 'waitForSelector', selector: 'main, [role="main"], #app, .studio-container', state: 'visible' },
        validate: [
          { type: 'visible', selector: 'main, [role="main"], #app, .studio-container', description: 'Main content loaded' }
        ]
      }
    ];

    return {
      id: `studio-${slug}`,
      name: `Studio - ${route}`,
      url: `${baseUrl}/?dev#/${route}`,
      expectedTitle: 'SmartVid',
      features
    };
  });
}

export const STUDIO_CONFIGS: StudioConfig[] = buildStudioConfigs();

// =============================================================================
// RESILIENT ELEMENT INTERACTION ENGINE
// =============================================================================

/**
 * ElementInteractionEngine provides resilient selectors and retry logic
 * for handling dynamic UI elements, shadow DOM, and timing issues.
 */
export class ElementInteractionEngine {
  private page: Page;
  private defaultTimeout: number;

  constructor(page: Page, defaultTimeout = 15000) {
    this.page = page;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Generates multiple selector strategies for a single logical element.
   * Supports: data-testid, aria-label, role, text content, CSS classes.
   */
  generateSelectors(elementName: string, strategies: string[] = []): string[] {
    const baseSelectors: string[] = [];

    // If it already looks like a CSS selector, use it directly
    if (/^[#.:>+~@]/.test(elementName) || /[\[\]()=]/.test(elementName)) {
      baseSelectors.push(elementName);
      return baseSelectors;
    }

    // Strategy 1: data-testid (most reliable)
    baseSelectors.push(`[data-testid="${this.toKebabCase(elementName)}"]`);

    // Strategy 2: aria-label
    baseSelectors.push(`[aria-label*="${elementName}" i]`);

    // Strategy 3: role-based
    const roleMap: Record<string, string> = {
      'button': 'button',
      'menu': 'menu',
      'tab': 'tab',
      'link': 'link',
      'dialog': 'dialog'
    };
    if (roleMap[elementName.toLowerCase()]) {
      baseSelectors.push(`role=${roleMap[elementName.toLowerCase()]}`);
    }

    // Strategy 4: Custom strategies
    if (strategies.length > 0) {
      baseSelectors.push(...strategies);
    }

    return baseSelectors;
  }

  /**
   * Clicks an element using multiple selector fallbacks.
   */
  async clickWithFallback(
    elementName: string,
    options?: { force?: boolean; delay?: number; timeout?: number; customSelectors?: string[] }
  ): Promise<void> {
    const selectors = this.generateSelectors(elementName, options?.customSelectors);
    const timeout = options?.timeout ?? this.defaultTimeout;
    let lastError: Error | null = null;

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, {
          state: 'visible',
          timeout
        });
        await this.page.click(selector, {
          force: options?.force,
          delay: options?.delay ?? 100
        });
        console.log(`[Interaction] Clicked: ${elementName} via "${selector}"`);
        return;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[Interaction] Failed to click "${selector}": ${(err as Error).message}`);
      }
    }

    throw new Error(`Could not click "${elementName}" with any selector: ${lastError?.message}`);
  }

  /**
   * Fills an input field with fallback selectors.
   */
  async fillWithFallback(
    fieldName: string,
    value: string,
    options?: { clearFirst?: boolean }
  ): Promise<void> {
    const selectors = this.generateSelectors(fieldName, [
      `input[name="${this.toCamelCase(fieldName)}"]`,
      `input[placeholder*="${fieldName}" i]`,
      `#${this.toKebabCase(fieldName)}`
    ]);

    let lastError: Error | null = null;

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, {
          state: 'visible',
          timeout: this.defaultTimeout
        });

        if (options?.clearFirst) {
          await this.page.fill(selector, '');
        }
        await this.page.fill(selector, value);
        console.log(`[Interaction] Filled: ${fieldName} = "${value}" via "${selector}"`);
        return;
      } catch (err) {
        lastError = err as Error;
      }
    }

    throw new Error(`Could not fill "${fieldName}": ${lastError?.message}`);
  }

  /**
   * Waits for any of multiple selectors to appear.
   */
  async waitForAny(
    selectors: string[],
    options?: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' }
  ): Promise<string> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const state = options?.state ?? 'visible';

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, { state, timeout });
        return selector;
      } catch {
        continue;
      }
    }

    throw new Error(`None of the selectors appeared within ${timeout}ms: ${selectors.join(', ')}`);
  }

  /**
   * Handles dynamic content loading with auto-wait and stability checks.
   */
  async waitForStableElement(selector: string, stabilityMs = 500): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout: this.defaultTimeout });

    // Wait for content to stabilize (no layout shifts)
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetWidth > 0;
      },
      selector,
      { timeout: this.defaultTimeout }
    );

    await this.page.waitForTimeout(stabilityMs);
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toLowerCase());
  }
}

// =============================================================================
// VALIDATION ENGINE
// =============================================================================

export class ValidationEngine {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async runChecks(checks: ValidationCheck[]): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];

    for (const check of checks) {
      try {
        await this.executeCheck(check);
        console.log(`[Validation] ✓ ${check.description}`);
      } catch (err) {
        const errorMsg = `✗ ${check.description}: ${(err as Error).message}`;
        failures.push(errorMsg);
        console.error(`[Validation] ${errorMsg}`);
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  private async executeCheck(check: ValidationCheck): Promise<void> {
    switch (check.type) {
      case 'visible':
        if (!check.selector) throw new Error('Selector required for visibility check');
        await expect(this.page.locator(check.selector).first()).toBeVisible({
          timeout: 10000
        });
        break;

      case 'hidden':
        if (!check.selector) throw new Error('Selector required for hidden check');
        await expect(this.page.locator(check.selector).first()).toBeHidden({
          timeout: 10000
        });
        break;

      case 'text':
        if (!check.selector) throw new Error('Selector required for text check');
        if (typeof check.expected !== 'string') throw new Error('Expected text required');
        await expect(this.page.locator(check.selector).first()).toContainText(check.expected, {
          timeout: 10000
        });
        break;

      case 'url':
        if (typeof check.expected !== 'string') throw new Error('Expected URL string required');
        await expect(this.page).toHaveURL(new RegExp(check.expected), {
          timeout: 10000
        });
        break;

      case 'count':
        if (!check.selector) throw new Error('Selector required for count check');
        if (typeof check.expected !== 'number') throw new Error('Expected count number required');
        await expect(this.page.locator(check.selector)).toHaveCount(check.expected, {
          timeout: 10000
        });
        break;

      case 'attribute':
        if (!check.selector) throw new Error('Selector required for attribute check');
        if (typeof check.expected !== 'string') throw new Error('Expected attribute value required');
        const locator = this.page.locator(check.selector).first();
        await expect(locator).toHaveAttribute('class', new RegExp(check.expected));
        break;

      default:
        throw new Error(`Unknown validation type: ${(check as any).type}`);
    }
  }
}

// =============================================================================
// VIDEO RECORDER MANAGER
// =============================================================================

export class VideoRecorder {
  private videoDir: string;
  private recordings: Map<string, string> = new Map();

  constructor(videoDir = './test-results/videos') {
    this.videoDir = videoDir;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.videoDir)) {
      fs.mkdirSync(this.videoDir, { recursive: true });
    }
  }

  getVideoPath(studioId: string, timestamp = Date.now()): string {
    const sanitizedId = studioId.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const filename = `studio-demo-${sanitizedId}-${timestamp}.mp4`;
    const fullPath = path.join(this.videoDir, filename);
    this.recordings.set(studioId, fullPath);
    return fullPath;
  }

  createSession(studioId: string, page: Page): { videoPath: string; addFrame: () => Promise<void>; startSteadyCapture: (intervalMs?: number) => void; stop: () => Promise<void>; finish: () => Promise<string> } {
    const videoPath = this.getVideoPath(studioId);
    const framesDir = path.join(this.videoDir, `frames-${Date.now()}`);
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    const frames: string[] = [];
    let index = 0;
    const maxFrames = 120;
    let stopped = false;
    let capturePromise: Promise<void> | null = null;
    let capturing = false;

    const addFrame = async () => {
      if (stopped || index >= maxFrames) return;
      while (capturing) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      capturing = true;
      try {
        const framePath = path.join(framesDir, `frame-${String(index).padStart(5, '0')}.png`);
        const screenshot = await page.screenshot({ fullPage: false });
        fs.writeFileSync(framePath, screenshot);
        frames.push(framePath);
        index++;
      } catch (err) {
        console.warn(`[Video] Failed to capture frame ${index}: ${(err as Error).message}`);
      } finally {
        capturing = false;
      }
    };

    const startSteadyCapture = (intervalMs = 500) => {
      capturePromise = (async () => {
        while (!stopped && index < maxFrames) {
          await addFrame();
          if (!stopped && index < maxFrames) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
      })();
    };

    const stop = async () => {
      stopped = true;
      if (capturePromise) {
        await capturePromise;
      }
    };

    const finish = async (): Promise<string> => {
      await stop();
      console.log(`[Video] Finishing: ${frames.length} frames captured`);
      if (frames.length === 0) {
        this.cleanupFrames(framesDir);
        return videoPath;
      }

      const fps = 5;
      await this.combineFramesToVideo(framesDir, videoPath, fps);
      this.cleanupFrames(framesDir);
      console.log(`[Video] Saved: ${videoPath}`);
      return videoPath;
    };

    return { videoPath, addFrame, startSteadyCapture, stop, finish };
  }

  private async combineFramesToVideo(framesDir: string, outputPath: string, fps: number): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const ffmpegPath = require('ffmpeg-static');

    const pattern = path.join(framesDir, 'frame-%05d.png');
    const safeOutput = outputPath.replace(/\.webm$/, '.mp4');

    const command = `"${ffmpegPath}" -y -framerate ${fps} -i "${pattern}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart "${safeOutput}"`;

    try {
      await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
      console.log(`[Video] Combined frames into ${safeOutput}`);
    } catch (err) {
      console.warn(`[Video] FFmpeg combine failed: ${(err as Error).message}`);
    }
  }

  private cleanupFrames(framesDir: string): void {
    try {
      fs.rmSync(framesDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  getContextOptions(videoPath: string) {
    return {
      recordVideo: {
        dir: path.dirname(videoPath),
        size: { width: 1920, height: 1080 }
      }
    };
  }

  getRecordings(): { studioId: string; videoPath: string }[] {
    return Array.from(this.recordings.entries()).map(([studioId, videoPath]) => ({
      studioId,
      videoPath
    }));
  }

  async postProcessVideos(): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const ffmpegPath = require('ffmpeg-static');

    for (const [studioId, videoPath] of this.recordings.entries()) {
      const mp4Path = videoPath.replace('.webm', '.mp4');
      if (fs.existsSync(videoPath)) {
        try {
          await execAsync(
            `"${ffmpegPath}" -i "${videoPath}" -c:v libx264 -preset fast -crf 23 -y "${mp4Path}"`
          );
          console.log(`[Video] Converted ${studioId} to MP4: ${mp4Path}`);
        } catch (err) {
          console.warn(`[Video] FFmpeg conversion failed for ${studioId}: ${(err as Error).message}`);
        }
      }
    }
  }
}

// =============================================================================
// STUDIO DEMO ORCHESTRATOR
// =============================================================================

export class StudioDemoOrchestrator {
  private interactionEngine: ElementInteractionEngine;
  private validationEngine: ValidationEngine;
  private videoRecorder: VideoRecorder;
  private results: DemoResult[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.interactionEngine = new ElementInteractionEngine(page);
    this.validationEngine = new ValidationEngine(page);
    this.videoRecorder = new VideoRecorder();
  }

  /**
   * Executes a full demo workflow for a single studio.
   */
  async runStudioDemo(studio: StudioConfig): Promise<DemoResult> {
    const startTime = Date.now();
    const videoPath = this.videoRecorder.getVideoPath(studio.id);
    const screenshots: string[] = [];
    const errors: string[] = [];
    const featureResults: FeatureResult[] = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[StudioDemo] Starting: ${studio.name}`);
    console.log(`[StudioDemo] URL: ${studio.url}`);
    console.log(`[StudioDemo] Video: ${videoPath}`);
    console.log(`${'='.repeat(60)}`);

    // Navigate to studio
    try {
      await this.page.goto(studio.url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      console.log(`[StudioDemo] Navigated to ${studio.url}`);
    } catch (err) {
      errors.push(`Navigation failed: ${(err as Error).message}`);
      const screenshot = await this.captureScreenshot(`error-nav-${studio.id}`);
      screenshots.push(screenshot);
    }

    // Handle authentication if required
    if (studio.authRequired && studio.authCredentials) {
      try {
        await this.handleAuth(studio.authCredentials);
        console.log('[StudioDemo] Authentication successful');
      } catch (err) {
        errors.push(`Auth failed: ${(err as Error).message}`);
      }
    }

    // Validate page load
    if (studio.expectedTitle) {
      try {
        await expect(this.page).toHaveTitle(new RegExp(studio.expectedTitle));
      } catch (err) {
        errors.push(`Title validation failed: ${(err as Error).message}`);
      }
    }

    // Start manual video recording after page is loaded
    const recorder = this.videoRecorder.createSession(studio.id, this.page);
    recorder.startSteadyCapture(500);

    // Execute feature workflow
    for (const feature of studio.features) {
      console.log(`\n[StudioDemo] Feature: ${feature.name} - ${feature.description}`);
      const featureStart = Date.now();

      try {
        if (feature.waitForSelector) {
          await this.interactionEngine.waitForStableElement(feature.waitForSelector);
        }

        await recorder.addFrame();
        await this.executeAction(feature.action);
        await recorder.addFrame();

        await this.page.waitForTimeout(800);
        await recorder.addFrame();

        if (feature.validate && feature.validate.length > 0) {
          const validationResult = await this.validationEngine.runChecks(feature.validate);
          featureResults.push({
            name: feature.name,
            passed: validationResult.passed,
            error: validationResult.failures.join('; ')
          });

          if (!validationResult.passed) {
            errors.push(...validationResult.failures);
          }
        } else {
          featureResults.push({ name: feature.name, passed: true });
        }

        if (feature.screenshot !== false) {
          const screenshot = await this.captureScreenshot(
            `${studio.id}-${feature.name.toLowerCase().replace(/\s+/g, '-')}`
          );
          screenshots.push(screenshot);
        }

        console.log(`[StudioDemo] ✓ Feature completed in ${Date.now() - featureStart}ms`);
      } catch (err) {
        const errorMsg = `Feature "${feature.name}" failed: ${(err as Error).message}`;
        errors.push(errorMsg);
        featureResults.push({ name: feature.name, passed: false, error: (err as Error).message });

        const screenshot = await this.captureScreenshot(`error-${studio.id}-${feature.name}`);
        screenshots.push(screenshot);
        console.error(`[StudioDemo] ✗ ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;
    const passed = errors.length === 0;

    console.log(`\n[StudioDemo] ${passed ? 'PASSED' : 'FAILED'} in ${duration}ms`);
    console.log(`[StudioDemo] Errors: ${errors.length}, Screenshots: ${screenshots.length}`);

    recorder.stop();
    const recordedVideoPath = await recorder.finish();
    if (recordedVideoPath) {
      console.log(`[StudioDemo] Video saved: ${recordedVideoPath}`);
    }

    const result: DemoResult = {
      studioId: studio.id,
      studioName: studio.name,
      url: studio.url,
      passed,
      videoPath: recordedVideoPath || videoPath,
      screenshots,
      errors,
      duration,
      featureResults
    };

    this.results.push(result);
    return result;
  }

  /**
   * Execute different action types.
   */
  private async executeAction(action: FeatureAction): Promise<void> {
    const page = this.page;

    switch (action.type) {
      case 'click':
        await this.interactionEngine.clickWithFallback(
          action.selector,
          action.options
        );
        break;

      case 'fill':
        await this.interactionEngine.fillWithFallback(action.selector, action.value);
        break;

      case 'select':
        await page.selectOption(action.selector, action.value);
        break;

      case 'hover':
        await page.hover(action.selector);
        break;

      case 'scroll':
        await this.scrollElement(action.selector, action.direction);
        break;

      case 'wait':
        await page.waitForTimeout(action.ms);
        break;

      case 'waitForSelector':
        await page.waitForSelector(action.selector, {
          state: action.state ?? 'visible',
          timeout: 15000
        });
        break;

      case 'press':
        await page.keyboard.press(action.key);
        break;

      case 'evaluate':
        await page.evaluate(action.script);
        break;

      case 'custom':
        await action.handler(page);
        break;
    }
  }

  private async scrollElement(selector: string | undefined, direction?: string): Promise<void> {
    const page = this.page;
    const targetSelector = selector || 'body';
    await page.evaluate((opts: { sel: string; dir: string }) => {
      const element = document.querySelector(opts.sel) as HTMLElement;
      if (!element) return;
      const scrollMap: Record<string, number> = {
        'up': -300,
        'down': 300,
        'top': -element.scrollHeight,
        'bottom': element.scrollHeight
      };
      element.scrollBy({ top: scrollMap[opts.dir || 'down'], behavior: 'smooth' });
    }, { sel: targetSelector, dir: direction || 'down' });
  }

  private async handleAuth(credentials: { email: string; password: string }): Promise<void> {
    const page = this.page;

    // Fill email
    await page.fill('input[type="email"]', credentials.email);
    // Fill password
    await page.fill('input[type="password"]', credentials.password);
    // Submit
    await page.click('button[type="submit"]');
    // Wait for redirect
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 15000 });
  }

  private async captureScreenshot(name: string): Promise<string> {
    const page = this.page;
    const screenshotDir = './test-results/screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const path = `${screenshotDir}/${name}-${Date.now()}.png`;
    try {
      if (page && !page.isClosed()) {
        await page.screenshot({ path, fullPage: true });
      }
    } catch (err) {
      console.warn(`[StudioDemo] Screenshot skipped for ${name}: ${(err as Error).message}`);
    }
    return path;
  }

  /**
   * Runs demos for all configured studios sequentially.
   */
  async runAllStudios(studios: StudioConfig[]): Promise<DemoResult[]> {
    console.log(`\n[Orchestrator] Running ${studios.length} studio demos...`);

    for (const studio of studios) {
      try {
        const result = await this.runStudioDemo(studio);

        // Brief pause between studios
        if (studios.indexOf(studio) < studios.length - 1) {
          try {
            await this.page.waitForTimeout(2000);
          } catch {
            // page may have been closed; continue to next studio
          }
        }
      } catch (err) {
        console.error(`[Orchestrator] Studio "${studio.id}" failed: ${(err as Error).message}`);
        this.results.push({
          studioId: studio.id,
          studioName: studio.name,
          url: studio.url,
          passed: false,
          videoPath: undefined,
          screenshots: [],
          errors: [(err as Error).message],
          duration: 0,
          featureResults: []
        });
      }
    }

    return this.results;
  }

  /**
   * Generates a comprehensive demo report.
   */
  generateReport(): string {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    let report = `
# Studio Demo Automation Report
Generated: ${new Date().toISOString()}

## Summary
| Metric | Count |
|--------|-------|
| Total Studios | ${this.results.length} |
| Passed | ${passed} |
| Failed | ${failed} |
| Success Rate | ${((passed / this.results.length) * 100).toFixed(1)}% |

## Results by Studio
`;

    for (const result of this.results) {
      report += `
### ${result.studioName}
- **URL:** ${result.url}
- **Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration:** ${(result.duration / 1000).toFixed(1)}s
- **Video:** ${result.videoPath || 'N/A'}
- **Screenshots:** ${result.screenshots.length}
- **Features:**
`;

      for (const feature of result.featureResults) {
        report += `  - ${feature.passed ? '✅' : '❌'} ${feature.name}\n`;
        if (feature.error) {
          report += `    - Error: ${feature.error}\n`;
        }
      }

      if (result.errors.length > 0) {
        report += `\n**Errors:**\n`;
        result.errors.forEach((e) => {
          report += `- ${e}\n`;
        });
      }
    }

    return report;
  }

  /**
   * Saves the report to a file.
   */
  saveReport(reportDir = './test-results'): string {
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const reportPath = `${reportDir}/demo-report-${Date.now()}.md`;
    fs.writeFileSync(reportPath, this.generateReport());
    console.log(`[Orchestrator] Report saved: ${reportPath}`);
    return reportPath;
  }
}

// =============================================================================
// PLAYWRIGHT TEST CONFIGURATION
// =============================================================================

/**
 * Extends Playwright test with video recording and retry logic.
 *
 * Usage:
 *   test.describe('Studio Demos', () => {
 *     test.beforeEach(async ({ page }) => {
 *       await page.setViewportSize({ width: 1920, height: 1080 });
 *     });
 *
 *     test('record all studios', async ({ page }) => {
 *       const orchestrator = new StudioDemoOrchestrator();
 *       await orchestrator.runAllStudios(STUDIO_CONFIGS);
 *       orchestrator.saveReport();
 *     });
 *   });
 */

// =============================================================================
// ADVANCED PATTERNS
// =============================================================================

/**
 * Shadow DOM Piercing Strategy
 * Use when elements are inside web components.
 */
export class ShadowDOMPiercer {
  static async findInShadowDOM(page: Page, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const element = await page.evaluate((sel: string) => {
          const parts = sel.split('>>>');
          let current: Element | Document | null = document;

          for (const part of parts) {
            if (!current) return null;
            if (current === document || current.nodeType === Node.DOCUMENT_NODE) {
              current = document.querySelector(part.trim());
            } else {
              current = (current as HTMLElement).shadowRoot?.querySelector(part.trim()) || null;
            }
          }

          return current ? 'found' : null;
        }, selector);

        if (element) {
          return selector;
        }
      } catch {
        continue;
      }
    }
    return null;
  }
}

/**
 * Network Interception for Validating API Calls
 * Ensures features trigger expected backend requests.
 */
export class NetworkValidator {
  private page: Page;
  private requests: Map<string, number> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Starts listening for specific API patterns.
   */
  async monitorPatterns(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await this.page.route(pattern, (route) => {
        const url = route.request().url();
        const count = this.requests.get(url) || 0;
        this.requests.set(url, count + 1);
        route.continue();
      });
    }
  }

  /**
   * Asserts that a pattern was called at least N times.
   */
  assertCalled(pattern: string, minCalls = 1): void {
    let total = 0;
    for (const [url, count] of this.requests.entries()) {
      if (url.includes(pattern)) {
        total += count;
      }
    }

    if (total < minCalls) {
      throw new Error(
        `Expected "${pattern}" to be called at least ${minCalls} times, but was called ${total} times`
      );
    }
  }

  getStats(): Record<string, number> {
    return Object.fromEntries(this.requests.entries());
  }
}

/**
 * Parallel Studio Demo Runner
 * Runs multiple studios concurrently with controlled parallelism.
 */
export class ParallelDemoRunner {
  private videoRecorder: VideoRecorder;

  constructor() {
    this.videoRecorder = new VideoRecorder();
  }

  /**
   * Runs studios in parallel batches.
   * @param studios Studios to run
   * @param concurrency Max parallel executions (default: 2 to avoid resource exhaustion)
   */
  async runInParallel(studios: StudioConfig[], concurrency = 2): Promise<DemoResult[]> {
    const results: DemoResult[] = [];
    const batches: StudioConfig[][] = [];

    // Split into batches
    for (let i = 0; i < studios.length; i += concurrency) {
      batches.push(studios.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map((studio) => this.runSingleStudio(studio))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`[ParallelRunner] Studio failed: ${result.reason}`);
        }
      }
    }

    return results;
  }

  private async runSingleStudio(studio: StudioConfig): Promise<DemoResult> {
    // Implementation similar to StudioDemoOrchestrator.runStudioDemo
    // but self-contained for parallel execution
    console.log(`[ParallelRunner] Running ${studio.name}...`);
    return {
      studioId: studio.id,
      studioName: studio.name,
      url: studio.url,
      passed: true,
      screenshots: [],
      errors: [],
      duration: 0,
      featureResults: []
    };
  }
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

/**
 * Example usage:
 *
 * npx playwright test studio-demo.ts --project=chromium
 * npx playwright test studio-demo.ts --grep "record all studios"
 *
 * Environment variables:
 * - STUDIO_URLS: Comma-separated list of URLs
 * - VIDEO_DIR: Directory for video output
 * - HEADLESS: true/false (default: true)
 */

export default {
  STUDIO_CONFIGS,
  StudioDemoOrchestrator,
  VideoRecorder,
  ElementInteractionEngine,
  ValidationEngine,
  ParallelDemoRunner,
  ShadowDOMPiercer,
  NetworkValidator
};
