import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('DefaultElement Enhancement Integration', () => {
  it('should integrate visual clip trimming functionality', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify trimming UI in render method
    expect(defaultElementContent).toContain('class="editor-section trimming"');
    expect(defaultElementContent).toContain('Trim Clip');
    expect(defaultElementContent).toContain('trimming-section');

    // Verify trimming methods
    expect(defaultElementContent).toContain('handleTrimChange');
    expect(defaultElementContent).toContain('updateTrimFrom');
    expect(defaultElementContent).toContain('updateTrimOut');
  });

  it('should integrate clip property management functionality', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify properties UI in render method
    expect(defaultElementContent).toContain('class="editor-section properties"');
    expect(defaultElementContent).toContain('Clip Properties');

    // Verify property management methods
    expect(defaultElementContent).toContain('handlePropertyChange');
    expect(defaultElementContent).toContain('updateProperty');
  });

  it('should integrate transition creation functionality', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify transitions UI in render method
    expect(defaultElementContent).toContain('class="editor-section transitions"');
    expect(defaultElementContent).toContain('Create Transition');

    // Verify transition methods
    expect(defaultElementContent).toContain('handleTransitionUpdate');
    expect(defaultElementContent).toContain('handleTransitionSelect');
  });

  it('should integrate overlay transitions functionality', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify overlay transitions UI in render method
    expect(defaultElementContent).toContain('class="editor-section overlays"');
    expect(defaultElementContent).toContain('Overlay Transitions');

    // Verify overlay methods
    expect(defaultElementContent).toContain('handleOverlayTransition');
  });

  it('should integrate basic AI content generation', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify AI generation imports
    expect(defaultElementContent).toContain('generationService');
    expect(defaultElementContent).toContain('createTextToVideoRequest');
    expect(defaultElementContent).toContain('createImageToVideoRequest');

    // Verify AI methods
    expect(defaultElementContent).toContain('generateContent');
    expect(defaultElementContent).toContain('generateTextContent');
    expect(defaultElementContent).toContain('generateImageContent');
    expect(defaultElementContent).toContain('generateVideoContent');

    // Verify AI UI in render method
    expect(defaultElementContent).toContain('ai-controls');
    expect(defaultElementContent).toContain('🤖 Generate');
  });

  it('should have editing mode toggle functionality', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify editing mode state
    expect(defaultElementContent).toContain('editingMode');
    expect(defaultElementContent).toContain('toggleEditing');

    // Verify editing UI conditional rendering
    expect(defaultElementContent).toContain('editingMode &&');
    expect(defaultElementContent).toContain('popcorn-element-editor');
  });

  it('should maintain original basic functionality', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify basic render structure
    expect(defaultElementContent).toContain('class="popcorn-element"');
    expect(defaultElementContent).toContain('popcorn-element-name');
    expect(defaultElementContent).toContain('POPCORN_ELEMENT_LABELS');

    // Verify contenteditable for htmlText
    expect(defaultElementContent).toContain('contenteditable="true"');
    expect(defaultElementContent).toContain('wrapTokens(item.htmlText)');
  });

  it('should extend Component class', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify class extension
    expect(defaultElementContent).toContain('export class DefaultElement extends Component');
    expect(defaultElementContent).toContain('import { Component } from \'../../../../base/Component.js\'');
  });

  it('should integrate with project store for updates', () => {
    const defaultElementPath = path.join(__dirname, '../../components/common/timeline/elements/DefaultElement.js');
    const defaultElementContent = fs.readFileSync(defaultElementPath, 'utf8');

    // Verify store integration
    expect(defaultElementContent).toContain('getStore');
    expect(defaultElementContent).toContain('projectStore');
    expect(defaultElementContent).toContain('updateElement');
  });
});