import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class AudioControls extends Component {
  constructor(options = {}) {
    super(options);
    this.selected = options.selected || null;
    this.volume = options.volume || 100;
    this.setVolume = options.setVolume || (() => {});
  }

  handleVolumeChange = (event) => {
    const volume = parseInt(event.target.value, 10);
    this.volume = volume;
    this.setVolume(volume);
  };

  render() {
    const trackName = this.selected ? this.selected.title : '';

    const html = `
      <div class="library__audio-controls">
        <div class="volume-container">
          <div class="volume-control">
            <label class="volume-label">Volume</label>
            <input
              type="range"
              min="0"
              max="100"
              value="${this.volume}"
              class="volume-slider"
              onchange="${this.handleVolumeChange.name}"
            />
            <input
              type="number"
              min="0"
              max="100"
              value="${this.volume}"
              class="volume-input"
              onchange="${this.handleVolumeChange.name}"
            />
          </div>
        </div>
        <div class="track-name">
          ${trackName}
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const slider = this.element.querySelector('.volume-slider');
      const input = this.element.querySelector('.volume-input');
      const trackName = this.element.querySelector('.track-name');

      if (slider) slider.value = this.volume;
      if (input) input.value = this.volume;
      if (trackName) trackName.textContent = this.selected ? this.selected.title : '';
    }
  }

  mount(element) {
    super.mount(element);
    const slider = this.element.querySelector('.volume-slider');
    const input = this.element.querySelector('.volume-input');

    if (slider) {
      slider.addEventListener('input', this.handleVolumeChange);
    }
    if (input) {
      input.addEventListener('input', this.handleVolumeChange);
    }
  }

  unmount() {
    const slider = this.element?.querySelector('.volume-slider');
    const input = this.element?.querySelector('.volume-input');

    if (slider) {
      slider.removeEventListener('input', this.handleVolumeChange);
    }
    if (input) {
      input.removeEventListener('input', this.handleVolumeChange);
    }
    super.unmount();
  }
}