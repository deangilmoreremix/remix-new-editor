import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';
import ClipEditor from './tabs/ClipEditor.js';

export default class VideoSettings extends Component {
  constructor(options = {}) {
    super(options);
    this.tab = options.tab || 'clip-editor';
    this.element = options.element || null;
    this.update = options.update || (() => {});
    this.fields = options.fields || {};
  }

  handleChange = (value, options) => {
    let newOptions = { ...value };
    if (options) {
      newOptions = { ...newOptions, ...options };
    }
    this.update(newOptions);
  };

  render() {
    let tabComponent;

    switch (this.tab) {
      case 'clip-editor':
      default:
        tabComponent = new ClipEditor({
          values: this.element?.popcornOptions || {},
          onChange: this.handleChange,
          fields: this.fields,
          element: this.element
        });
        break;
    }

    const html = `
      <div class="video-settings-form">
        ${this.element && this.element.popcornOptions ? tabComponent.render().outerHTML : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Re-render when element changes
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }
}