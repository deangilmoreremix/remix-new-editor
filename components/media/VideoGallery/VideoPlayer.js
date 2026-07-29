import { Component } from '../../base/Component.js';

export class VideoPlayer extends Component {
  constructor(props = {}) {
    super(props);
    this.url = props.url;
    this.autoPlay = props.autoPlay !== false;
    this.controls = props.controls !== false;
    this.loop = props.loop || false;
    this.muted = props.muted || false;
    this.containerClassName = props.containerClassName || 'video-player-container';
    this.videoClassName = props.videoClassName || 'video-player';
  }

  render() {
    const html = `
      <div class="${this.containerClassName}">
        <video class="${this.videoClassName}" preload="true" ${this.autoPlay ? 'autoplay' : ''} ${this.muted ? 'muted' : ''} ${this.controls ? 'controls' : ''} ${this.loop ? 'loop' : ''}>
          <source src="${this.url}" type="video/mp4" />
        </video>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export default VideoPlayer;