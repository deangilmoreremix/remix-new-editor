import { Component } from '../../components/base/Component.js';

export class Layer extends Component {
  constructor(props = {}) {
    super(props);

    if (!props.layer) {
      throw new Error('layer required');
    }

    const layer = props.layer || {};
    this.state = {
      name: layer.name || 'Untitled Layer',
      isVisible: layer.visible !== false,
      isLocked: layer.locked || false,
      isSolo: layer.solo || false,
      opacity: layer.opacity ?? 1.0
    };
  }

  get isVisible() {
    return this.state.isVisible;
  }

  get isLocked() {
    return this.state.isLocked;
  }

  get isSolo() {
    return this.state.isSolo;
  }

  get opacity() {
    return this.state.opacity;
  }

  toggleVisibility() {
    this.setState({ isVisible: !this.state.isVisible });
  }

  toggleLock() {
    this.setState({ isLocked: !this.state.isLocked });
  }

  toggleSolo() {
    this.setState({ isSolo: !this.state.isSolo });
  }

  setOpacity(value) {
    const clamped = Math.max(0, Math.min(1, value));
    this.setState({ opacity: clamped });
  }

  mount(container) {
    if (!container && this.props && this.props.container) {
      container = this.props.container;
    }
    return super.mount(container);
  }

  render() {
    const container = document.createElement('div');
    container.className = 'layer';

    const nameEl = document.createElement('span');
    nameEl.className = 'layer-name';
    nameEl.textContent = this.state.name;
    container.appendChild(nameEl);

    const controls = document.createElement('div');
    controls.className = 'layer-controls';

    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'visibility-btn';
    visibilityBtn.setAttribute('aria-label', `Toggle visibility for ${this.state.name}`);
    visibilityBtn.textContent = this.state.isVisible ? '👁️' : '👁️‍🗨️';
    visibilityBtn.addEventListener('click', () => this.toggleVisibility());
    controls.appendChild(visibilityBtn);

    const lockBtn = document.createElement('button');
    lockBtn.className = 'lock-btn';
    lockBtn.setAttribute('aria-label', `Toggle lock for ${this.state.name}`);
    lockBtn.textContent = this.state.isLocked ? '🔒' : '🔓';
    lockBtn.addEventListener('click', () => this.toggleLock());
    controls.appendChild(lockBtn);

    const soloBtn = document.createElement('button');
    soloBtn.className = 'solo-btn';
    soloBtn.setAttribute('aria-label', `Toggle solo for ${this.state.name}`);
    soloBtn.textContent = this.state.isSolo ? 'S' : 's';
    soloBtn.addEventListener('click', () => this.toggleSolo());
    controls.appendChild(soloBtn);

    container.appendChild(controls);
    return container;
  }
}
