import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class AnimationList extends Component {
  constructor(options = {}) {
    super(options);
    this.onSelect = options.onSelect || (() => {});
    this.element = options.element || {};
    this.animations = options.animations || {
      fade: [
        { label: 'Fade In', value: 'fade-in', type: 'in' },
        { label: 'Fade Out', value: 'fade-out', type: 'out' }
      ],
      slide: [
        { label: 'Slide Up', value: 'slide-up', type: 'in' },
        { label: 'Slide Down', value: 'slide-down', type: 'out' }
      ],
      scale: [
        { label: 'Scale In', value: 'scale-in', type: 'in' },
        { label: 'Scale Out', value: 'scale-out', type: 'out' }
      ]
    };
    this.selected = {};
  }

  handleAnimationSelect = (animation, type) => {
    this.onSelect(animation, type);
    this.selected[type] = animation;
    this.update();
  };

  handleClose = () => {
    // Close animation library
    if (this.onClose) {
      this.onClose();
    }
  };

  render() {
    const animationBlocks = Object.keys(this.animations).map(animationType => {
      const animationItems = this.animations[animationType].map(item => `
        <div class="animation-item ${item.type} ${this.selected[item.type] === item.value ? 'selected' : ''}"
             onclick="this.handleAnimationSelect('${item.value}', '${item.type}')">
          <div class="animation-preview">
            <div class="animation-icon">${this.getAnimationIcon(item.value)}</div>
          </div>
          <div class="animation-label">${item.label}</div>
        </div>
      `).join('');

      return `
        <div class="animation-block">
          <h4 class="animation-type">${animationType.charAt(0).toUpperCase() + animationType.slice(1)} Animations</h4>
          <div class="animation-grid">
            ${animationItems}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="animation-list">
        <div class="animation-header">
          <h3>Choose Animation</h3>
          <button class="close-btn" onclick="this.handleClose()">×</button>
        </div>
        <div class="animation-content">
          ${animationBlocks}
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  getAnimationIcon(animationType) {
    const icons = {
      'fade-in': '⬇️',
      'fade-out': '⬆️',
      'slide-up': '⬆️',
      'slide-down': '⬇️',
      'scale-in': '⏫',
      'scale-out': '⏬'
    };
    return icons[animationType] || '✨';
  }

  update() {
    // Update selected states
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleAnimationSelect = this.handleAnimationSelect.bind(this);
    this.element.handleClose = this.handleClose.bind(this);
  }
}