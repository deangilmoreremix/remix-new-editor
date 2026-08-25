import { Component } from '../../base/Component.js';

export class VideoTile extends Component {
  constructor(props = {}) {
    super(props);
    this.onPreview = props.onPreview;
    this.onSelect = props.onSelect;
    this.url = props.url;
    this.preview = props.preview;
    this.title = props.title;
    this.poster = props.poster || 'https://cdn.vidcloud.io/revolution/resources/poster.png';
    this.previewContainer = null;
  }

  onMount() {
    this.previewContainer = this.element.querySelector('video');
    this.setupEvents();
  }

  setupEvents() {
    const overlay = this.element.querySelector('.overlay');
    this.addEventListener(overlay, 'mouseover', () => this.togglePreview(true));
    this.addEventListener(overlay, 'mouseout', () => this.togglePreview(false));

    const btnPreview = this.element.querySelector('.btn-preview');
    this.addEventListener(btnPreview, 'click', () => this.onPreview(this.title, this.url));

    const btnUse = this.element.querySelector('.generator-use');
    this.addEventListener(btnUse, 'click', () => this.onSelect(this.url));
  }

  togglePreview(state) {
    if (this.previewContainer) {
      if (state) {
        this.previewContainer.play();
      } else {
        this.previewContainer.pause();
      }
    }
  }

  render() {
    const link = this.preview || this.url;
    const isWebm = link.includes('webm');
    const type = isWebm ? 'video/webm' : 'video/mp4';
    const html = `
      <div class="video-tile" style="background-image: url(${this.poster})">
        <video class="video" muted preload="metadata">
          <source src="${link}" type="${type}" />
        </video>
        <div class="overlay">
          <div class="buttons-container">
            <button class="btn-preview">
              <img class="btn-preview__icon" src="../../../public/static/images/circle-play.svg" alt="play" />
            </button>
            <p class="title">${this.title}</p>
            <button class="button generator-use">use</button>
          </div>
        </div>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export default VideoTile;