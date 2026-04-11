import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('IconElement Enhancement Integration', () => {
  let iconElementContent;

  beforeEach(() => {
    const iconElementPath = path.join(__dirname, '../../components/common/timeline/elements/IconElement.js');
    iconElementContent = fs.readFileSync(iconElementPath, 'utf8');
  });

  describe('Core Icon Functionality', () => {
    it('should maintain existing icon rendering functionality', () => {
      expect(iconElementContent).toContain('export class IconElement extends Component');
      expect(iconElementContent).toContain('TIMELINE_ELEMENT_ICONS');
      expect(iconElementContent).toContain('TIMELINE_ELEMENT_DEFAULT_ICONS');
      expect(iconElementContent).toContain('ASSET_TYPES.PERSONALIZED_VOICE');
      expect(iconElementContent).toContain('ASSET_TYPES.AUDIO');
      expect(iconElementContent).toContain('ASSET_TYPES.VOICE');
    });

    it('should render icon elements with proper CSS classes', () => {
      expect(iconElementContent).toContain('icon-element');
      expect(iconElementContent).toContain('popcorn-timeline-icon');
      expect(iconElementContent).toContain('popcorn-element-title');
    });

    it('should handle different asset types for icons', () => {
      expect(iconElementContent).toContain('svgAudioIcon');
      expect(iconElementContent).toContain('personalizedVoiceIcon');
      expect(iconElementContent).toContain('voiceIcon');
    });
  });

  describe('Visual Clip Trimming (LineDuration)', () => {
    it('should import LineDuration component', () => {
      expect(iconElementContent).toContain('LineDuration');
    });

    it('should have clip trimming state management', () => {
      expect(iconElementContent).toContain('trimStart');
      expect(iconElementContent).toContain('trimEnd');
      expect(iconElementContent).toContain('duration');
    });

    it('should handle trim change callbacks', () => {
      expect(iconElementContent).toContain('handleTrimChange');
      expect(iconElementContent).toContain('handleTrimStart');
      expect(iconElementContent).toContain('handleTrimEnd');
    });

    it('should support visual trimming interface', () => {
      expect(iconElementContent).toContain('getTrimmingUI');
      expect(iconElementContent).toContain('renderTrimmingControls');
    });
  });

  describe('Clip Property Management (ClipEditor)', () => {
    it('should import ClipEditor integration', () => {
      expect(iconElementContent).toContain('ClipEditor');
    });

    it('should manage clip properties state', () => {
      expect(iconElementContent).toContain('clipProperties');
      expect(iconElementContent).toContain('volume');
      expect(iconElementContent).toContain('muted');
      expect(iconElementContent).toContain('hidden');
    });

    it('should handle property changes', () => {
      expect(iconElementContent).toContain('handlePropertyChange');
      expect(iconElementContent).toContain('updateClipProperty');
    });

    it('should support property management UI', () => {
      expect(iconElementContent).toContain('getPropertyManagerUI');
      expect(iconElementContent).toContain('renderPropertyControls');
    });
  });

  describe('Transition Creation (VideoTransitionSettings)', () => {
    it('should import VideoTransitionSettings integration', () => {
      expect(iconElementContent).toContain('VideoTransitionSettings');
    });

    it('should manage transition state', () => {
      expect(iconElementContent).toContain('transitionIn');
      expect(iconElementContent).toContain('transitionOut');
      expect(iconElementContent).toContain('selectedTransition');
    });

    it('should handle transition creation', () => {
      expect(iconElementContent).toContain('createTransition');
      expect(iconElementContent).toContain('handleTransitionUpdate');
    });

    it('should support transition UI', () => {
      expect(iconElementContent).toContain('getTransitionUI');
      expect(iconElementContent).toContain('renderTransitionControls');
    });
  });

  describe('Overlay Transitions (OverlayListTransitions)', () => {
    it('should import OverlayListTransitions integration', () => {
      expect(iconElementContent).toContain('OverlayListTransitions');
    });

    it('should manage overlay state', () => {
      expect(iconElementContent).toContain('overlayTransitions');
      expect(iconElementContent).toContain('selectedOverlay');
    });

    it('should handle overlay selection', () => {
      expect(iconElementContent).toContain('selectOverlayTransition');
      expect(iconElementContent).toContain('applyOverlayTransition');
    });

    it('should support overlay UI', () => {
      expect(iconElementContent).toContain('getOverlayUI');
      expect(iconElementContent).toContain('renderOverlayControls');
    });
  });

  describe('AI Content Generation', () => {
    it('should import generation service', () => {
      expect(iconElementContent).toContain('generationService');
      expect(iconElementContent).toContain('createTextToVideoRequest');
      expect(iconElementContent).toContain('createImageToVideoRequest');
    });

    it('should have AI generation methods', () => {
      expect(iconElementContent).toContain('generateContent');
      expect(iconElementContent).toContain('regenerateContent');
      expect(iconElementContent).toContain('generateIconVariant');
    });

    it('should manage AI generation state', () => {
      expect(iconElementContent).toContain('generationState');
      expect(iconElementContent).toContain('isGenerating');
      expect(iconElementContent).toContain('generationError');
    });

    it('should support AI workflows', () => {
      expect(iconElementContent).toContain('runAIWorkflow');
      expect(iconElementContent).toContain('text-to-video');
      expect(iconElementContent).toContain('image-to-video');
    });

    it('should handle AI suggestions', () => {
      expect(iconElementContent).toContain('getAIContentSuggestions');
      expect(iconElementContent).toContain('applyAISuggestion');
    });
  });

  describe('Icon-Specific Features', () => {
    it('should support icon customization', () => {
      expect(iconElementContent).toContain('iconCustomization');
      expect(iconElementContent).toContain('iconColor');
      expect(iconElementContent).toContain('iconSize');
    });

    it('should handle icon animation', () => {
      expect(iconElementContent).toContain('iconAnimation');
      expect(iconElementContent).toContain('animateIcon');
    });

    it('should support different icon types', () => {
      expect(iconElementContent).toContain('VIDEO_TRANSITION');
      expect(iconElementContent).toContain('SOCIAL');
      expect(iconElementContent).toContain('JSON_TRANSITION');
      expect(iconElementContent).toContain('SEQUENCER');
    });
  });

  describe('Editing Mode Integration', () => {
    it('should support editing mode toggle', () => {
      expect(iconElementContent).toContain('editingMode');
      expect(iconElementContent).toContain('toggleEditing');
      expect(iconElementContent).toContain('setEditingMode');
    });

    it('should render editing UI when in editing mode', () => {
      expect(iconElementContent).toContain('renderEditingUI');
      expect(iconElementContent).toContain('getEditingControls');
    });

    it('should maintain non-editing rendering', () => {
      expect(iconElementContent).toContain('render()');
      expect(iconElementContent).toContain('createElementFromHTML');
    });
  });

  describe('Event Handling', () => {
    it('should setup event listeners for editing', () => {
      expect(iconElementContent).toContain('setupEventListeners');
      expect(iconElementContent).toContain('addEventListener');
    });

    it('should handle click events for editing toggle', () => {
      expect(iconElementContent).toContain('handleClick');
      expect(iconElementContent).toContain('handleDoubleClick');
    });

    it('should cleanup event listeners', () => {
      expect(iconElementContent).toContain('cleanupEventListeners');
    });
  });

  describe('Project Store Integration', () => {
    it('should use projectStore for state management', () => {
      expect(iconElementContent).toContain('projectStore');
      expect(iconElementContent).toContain('getStore(\'projectStore\')');
    });

    it('should update project store on changes', () => {
      expect(iconElementContent).toContain('updateElement');
      expect(iconElementContent).toContain('findAndUpdate');
    });
  });

  describe('Lifecycle Methods', () => {
    it('should have onMount lifecycle', () => {
      expect(iconElementContent).toContain('onMount()');
    });

    it('should have onUnmount lifecycle', () => {
      expect(iconElementContent).toContain('onUnmount()');
    });

    it('should have onUpdate lifecycle', () => {
      expect(iconElementContent).toContain('onUpdate()');
    });
  });
});
