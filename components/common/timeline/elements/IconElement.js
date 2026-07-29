import { Component } from '../../../../base/Component.js';
import { getStore } from '../../../../stores/base/Store.js';
import classnames from 'classnames';
import { ASSET_TYPES } from '../../../../lib/constants/media';
import {
  POPCORN_ELEMENT_LABELS,
  POPCORN_ELEMENT_TYPES,
  SEQUENCER,
} from '../../../../lib/constants/popcorn';
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings';
import {
  TIMELINE_ELEMENT_DEFAULT_FIELD as DEFAULT_FIELD,
  TIMELINE_ELEMENT_DEFAULT_ICONS,
  TIMELINE_ELEMENT_ICONS,
} from '../../../../lib/constants/timeline';

import svgAudioIcon from '../../../../public/static/images/media/icon-audio.svg';
import personalizedVoiceIcon from '../../../../public/static/images/media/personalized-voice.svg';
import voiceIcon from '../../../../public/static/images/media/voice.svg';

export class IconElement extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');

    this.state = {
      item: props.item,
      className: props.className,
    };
  }

  render() {
    const { item, className } = this.state;
    const { isAudio } = this.projectStore;

    let kind = null;
    if (!item.kind && item.type === SEQUENCER) {
      kind = isAudio({ popcornOptions: item }) ? ASSET_TYPES.AUDIO : ASSET_TYPES.VIDEO;
    }

    let icon = null;
    if (item.kind === ASSET_TYPES.PERSONALIZED_VOICE) {
      icon = personalizedVoiceIcon;
    } else if (item.kind === ASSET_TYPES.AUDIO || kind === ASSET_TYPES.AUDIO) {
      icon = svgAudioIcon;
    } else if (item.kind === ASSET_TYPES.VOICE) {
      icon = voiceIcon;
    } else {
      icon = TIMELINE_ELEMENT_ICONS[item.type];
    }

    const quantityIcon = TIMELINE_ELEMENT_DEFAULT_ICONS[item.type];

    let itemTitle = '';
    if (!(item.kind === ASSET_TYPES.VOICE
      || item.kind === ASSET_TYPES.VIDEO
      || kind === ASSET_TYPES.VIDEO
      || kind === ASSET_TYPES.AUDIO
      || item.kind === ASSET_TYPES.AUDIO)) {
      if (item.type === POPCORN_ELEMENT_TYPES.SOCIAL) {
        itemTitle = item.title;
      } else {
        itemTitle = POPCORN_ELEMENT_LABELS[item.type];
      }
    } else {
      itemTitle = item.kind || kind;
    }

    let innerHTML = '';

    if (icon) {
      innerHTML += `<div class="${classnames('inner-wrapper', 'popcorn-timeline-icon')}"><div class="icon-btn--inline">${icon}</div></div>`;
    }

    if (item.kind !== ASSET_TYPES.PERSONALIZED_VOICE && item.type !== POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION) {
      innerHTML += `<div class="popcorn-element-title">${itemTitle}</div>`;
      innerHTML += `<div class="${classnames('inner-wrapper', 'popcorn-timeline-icon')}">`;
      if (quantityIcon && item[DEFAULT_FIELD[item.type]] === DEFAULT_SETTINGS[item.type][DEFAULT_FIELD[item.type]]) {
        innerHTML += `<div class="icon-btn--inline">${quantityIcon}</div>`;
      } else {
        innerHTML += item[DEFAULT_FIELD[item.type]];
      }
      innerHTML += `</div>`;
    }

    const html = `
      <div class="${classnames(className, 'popcorn-element', 'icon-element', \`popcorn-${item.type}-element\`, { 'popcorn-element-personalized-voice': item.kind === ASSET_TYPES.PERSONALIZED_VOICE })}" title="${item.title || item.htmlText || item.type}" tabindex="-1">
        ${innerHTML}
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}
