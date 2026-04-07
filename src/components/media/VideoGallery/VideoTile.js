import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class VideoTile extends Component {
  constructor(options = {}) {
    super(options);
    this.url = options.url || '';
    this.title = options.title || '';
    this.preview = options.preview || '';
    this.poster = options.poster || '';
    this.onSelect = options.onSelect || (() => {});
    this.onPreview = options.onPreview || (() => {});
    this.isWebm = (this.preview || this.url).includes('webm');
  }

  handlePreview = () => {
    this.onPreview(this.title, this.url);
  };

  handleSelect = () => {
    this.onSelect(this.url);
  };

  handleMouseOver = () => {
    const video = this.element?.querySelector('video');
    if (video) {
      video.play();
    }
  };

  handleMouseOut = () => {
    const video = this.element?.querySelector('video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  render() {
    const posterUrl = this.poster || 'https://cdn.vidcloud.io/revolution/resources/poster.png';

    const html = `
      <div class="video-tile" style="background-image: url(${posterUrl})">
        <video
          class="video"
          muted
          preload="metadata"
          onmouseover="${this.handleMouseOver.name}"
          onmouseout="${this.handleMouseOut.name}"
        >
          <source src="${this.preview || this.url}" type="${this.isWebm ? 'video/webm' : 'video/mp4'}" />
        </video>

        <div class="overlay">
          <div class="buttons-container">
            <button class="btn-preview" onclick="${this.handlePreview.name}">
              <span class="play-icon">▶️</span>
            </button>
            <p class="title">${this.title}</p>
            <button class="button generator-use" onclick="${this.handleSelect.name}">use</button>
          </div>
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  mount(element) {
    super.mount(element);
    this.element.handlePreview = this.handlePreview.bind(this);
    this.element.handleSelect = this.handleSelect.bind(this);
    this.element.handleMouseOver = this.handleMouseOver.bind(this);
    this.element.handleMouseOut = this.handleMouseOut.bind(this);
  }
}