import { Component } from '../../components/base/Component.js';

export class Clip extends Component {
  constructor(props = {}) {
    super(props);

    if (!props.clip && !props.timeline) {
      throw new Error('clip and timeline required');
    }

    const clip = props.clip || {};
    const timeline = props.timeline || {};
    
    this.state = {
      isSelected: false,
      start: clip.start || 0,
      end: clip.end || 100,
      duration: clip.duration || 100,
      trackId: clip.trackId || null
    };

    this.timeline = timeline;
    this.onClick = props.onClick || null;
  }

  get isSelected() {
    return this._isSelected ?? this.state.isSelected;
  }

  set isSelected(value) {
    this._isSelected = value;
  }

  select() {
    this.state.isSelected = true;
    this._isSelected = true;
    if (typeof this.timeline.selectClip === 'function') {
      this.timeline.selectClip(this.props.clip.id, false);
    }
  }

  deselect() {
    this.state.isSelected = false;
    this._isSelected = false;
    if (typeof this.timeline.deselectClip === 'function') {
      this.timeline.deselectClip(this.props.clip.id);
    }
  }

  mount(container) {
    if (!container && this.props && this.props.container) {
      container = this.props.container;
    }
    return super.mount(container);
  }

  getPosition() {
    const zoom = typeof this.timeline.getZoom === 'function' ? this.timeline.getZoom() : 1;
    return this.state.start * zoom;
  }

  handleClick() {
    if (typeof this.onClick === 'function') {
      this.onClick(this);
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'clip';
    container.setAttribute('tabindex', '0');
    return container;
  }
}
