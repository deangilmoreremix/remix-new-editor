import Component from '../../base/Component.js';
import { createElementFromHTML } from '../../../utils/jsx.js';

export default class ClipEditor extends Component {
  constructor(options = {}) {
    super(options);
    this.values = options.values || {};
    this.fields = options.fields || {};
    this.element = options.element || null;
    this.onChange = options.onChange || (() => {});
  }

  handleFieldChange = (field, value) => {
    this.onChange({ [field]: value });
  };

  render() {
    const {
      from = 0,
      mute = false,
      hidden = false,
      volume = 100,
      title = '',
      start = 0,
      end = 0,
      duration = 0,
      audioFadeIn = 0,
      audioFadeOut = 0,
      source = '',
      contentType = '',
      kind = ''
    } = this.values;

    const html = `
      <div class="clip-editor">
        <div class="clip-header">
          <h4>Clip Editor</h4>
          <span class="clip-title">${title || 'Untitled Clip'}</span>
        </div>

        <div class="clip-properties">
          <div class="property-group">
            <label>Timing</label>
            <div class="timing-controls">
              <div class="control">
                <label>Start:</label>
                <input type="number" value="${start}" step="0.1"
                       onchange="this.handleFieldChange('start', parseFloat(this.value))" />
              </div>
              <div class="control">
                <label>End:</label>
                <input type="number" value="${end}" step="0.1"
                       onchange="this.handleFieldChange('end', parseFloat(this.value))" />
              </div>
              <div class="control">
                <label>Duration:</label>
                <span>${duration.toFixed(2)}s</span>
              </div>
            </div>
          </div>

          <div class="property-group">
            <label>Audio</label>
            <div class="audio-controls">
              <div class="control">
                <label>Volume:</label>
                <input type="range" min="0" max="100" value="${volume}"
                       onchange="this.handleFieldChange('volume', parseInt(this.value))" />
                <span>${volume}%</span>
              </div>
              <div class="control">
                <label>
                  <input type="checkbox" ${mute ? 'checked' : ''}
                         onchange="this.handleFieldChange('mute', this.checked)" />
                  Mute
                </label>
              </div>
              <div class="control">
                <label>Fade In:</label>
                <input type="number" value="${audioFadeIn}" step="0.1" min="0"
                       onchange="this.handleFieldChange('audioFadeIn', parseFloat(this.value))" />
              </div>
              <div class="control">
                <label>Fade Out:</label>
                <input type="number" value="${audioFadeOut}" step="0.1" min="0"
                       onchange="this.handleFieldChange('audioFadeOut', parseFloat(this.value))" />
              </div>
            </div>
          </div>

          <div class="property-group">
            <label>Visibility</label>
            <div class="visibility-controls">
              <label>
                <input type="checkbox" ${hidden ? 'checked' : ''}
                       onchange="this.handleFieldChange('hidden', this.checked)" />
                Hidden
              </label>
            </div>
          </div>

          ${source ? `
            <div class="property-group">
              <label>Source</label>
              <div class="source-info">
                <span>Type: ${contentType}</span>
                <span>Kind: ${kind}</span>
                <span>From: ${from}s</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Update when values change
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleFieldChange = this.handleFieldChange.bind(this);
  }
}