import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class VideoPlayer extends Component {
  constructor(options = {}) {
    super(options);
    this.url = options.url || '';
    this.autoPlay = options.autoPlay !== false;
    this.controls = options.controls !== false;
    this.loop = options.loop || false;
    this.muted = options.muted || false;
    this.containerClassName = options.containerClassName || 'video-player-container';
    this.videoClassName = options.videoClassName || 'video-player';
  }

  render() {
    const videoType = this.url.includes('webm') ? 'video/webm' : 'video/mp4';

    const html = `
      <div class="${this.containerClassName}">
        <video
          class="${this.videoClassName}"
          preload="true"
          ${this.autoPlay ? 'autoplay' : ''}
          ${this.muted ? 'muted' : ''}
          ${this.controls ? 'controls' : ''}
          ${this.loop ? 'loop' : ''}
        >
          <source src="${this.url}" type="${videoType}" />
          Your browser does not support the video tag.
        </video>
      </div>
    `;

    return createElementFromHTML(html);
  }

  play() {
    const video = this.element?.querySelector('video');
    if (video) {
      video.play();
    }
  }

  pause() {
    const video = this.element?.querySelector('video');
    if (video) {
      video.pause();
    }
  }

  setCurrentTime(time) {
    const video = this.element?.querySelector('video');
    if (video) {
      video.currentTime = time;
    }
  }

  getCurrentTime() {
    const video = this.element?.querySelector('video');
    return video ? video.currentTime : 0;
  }

  getDuration() {
    const video = this.element?.querySelector('video');
    return video ? video.duration : 0;
  }
}