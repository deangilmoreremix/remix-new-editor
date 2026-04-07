import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class AudioPreview extends Component {
  constructor(options = {}) {
    super(options);
    this.item = options.item || {};
    this.isActive = options.isActive || false;
    this.volume = options.volume || 100;
    this.isDisplayIcon = options.isDisplayIcon !== false;
    this.onEnded = options.onEnded || (() => {});
  }

  render() {
    let content;

    if (this.isActive) {
      content = `
        <div class="playing-now-icon">
          <img src="/static/images/media/audio-playing.gif" alt="Playing" />
        </div>
        <audio
          src="${this.item.url || ''}"
          volume="${this.volume / 100}"
          autoplay
          onended="${this.onEnded.name}"
        ></audio>
      `;
    } else {
      if (this.item.preview && this.isDisplayIcon) {
        content = `<img src="${this.item.preview}" alt="Audio preview" class="audio-preview-icon" />`;
      } else if (this.isDisplayIcon) {
        content = `
          <div class="audio-icon-placeholder">
            <svg class="audio-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        `;
      } else {
        content = '';
      }
    }

    const html = `
      <div class="library__item-audio-preview">
        ${content}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const audio = this.element.querySelector('audio');
      if (audio) {
        audio.volume = this.volume / 100;
      }
    }
  }

  play() {
    const audio = this.element?.querySelector('audio');
    if (audio) {
      audio.play();
    }
  }

  pause() {
    const audio = this.element?.querySelector('audio');
    if (audio) {
      audio.pause();
    }
  }

  mount(element) {
    super.mount(element);
    const audio = this.element.querySelector('audio');
    if (audio) {
      audio.addEventListener('ended', this.onEnded);
    }
  }

  unmount() {
    const audio = this.element?.querySelector('audio');
    if (audio) {
      audio.removeEventListener('ended', this.onEnded);
    }
    super.unmount();
  }
}