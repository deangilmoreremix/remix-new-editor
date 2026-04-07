import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import classnames from 'classnames';
import { DEFAULT_FONT_SIZE, DEFAULT_VIDEO_WIDTH, DEFAULT_THUMBNAIL } from '../../../lib/constants/project';

export class Preview extends Component {
  constructor(props = {}) {
    super(props);
    this.presetStore = getStore('presetStore');

    this.state = {
      preview: props.preview,
      activeItem: props.activeItem,
      className: props.className,
      instantStart: props.instantStart || false,
      fontSize: DEFAULT_FONT_SIZE,
    };

    this.wrapper = null;
    this.play = this.play.bind(this);
  }

  componentDidMount() {
    if (this.wrapper && this.state.activeItem) {
      this.presetStore.destroyPopcorn();
      this.presetStore.setPopcorn(this.wrapper);
    }
    if (this.wrapper) {
      this.setState({ fontSize: `${DEFAULT_FONT_SIZE * (this.wrapper.offsetWidth / DEFAULT_VIDEO_WIDTH)}px` });
    }
  }

  componentWillUnmount() {
    this.presetStore.destroyPopcorn();
  }

  play() {
    this.presetStore.playPreset();
  }

  render() {
    const { preview, activeItem, className, instantStart, fontSize } = this.state;
    const { isPlayed } = this.presetStore;

    let innerHTML = '';

    if (preview && DEFAULT_THUMBNAIL !== preview) {
      innerHTML += `<img src="${preview}" class="project-data-preview__img" alt="preview" />`;
    }

    if (instantStart) {
      innerHTML += `<div class="project-data-preview__unselect"></div>`;
    } else {
      innerHTML += `
        <div class="${classnames('project-data-preview__button-block', { 'project-data-preview__button-bg': !preview && !isPlayed, 'project-data-preview__button-active': isPlayed })}">
          ${activeItem && !isPlayed ? `<button class="project-data-preview__play" onclick="${this.play.name}"></button>` : ''}
        </div>
      `;
    }

    const html = `<div class="${classnames('project-data-preview', className)}" style="font-size: ${fontSize}">${innerHTML}</div>`;

    const element = this.createElementFromHTML(html);
    this.wrapper = element;

    return element;
  }
}
