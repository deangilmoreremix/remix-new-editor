import { Component } from '../../../../base/Component.js';
import { getStore } from '../../../../stores/base/Store.js';
import classnames from 'classnames';
import { ANIMATION_TYPES, NONE_CLASS } from '../../../../lib/constants/animations';
import { POPCORN_ELEMENT_LABELS, POPCORN_ELEMENT_TYPES } from '../../../../lib/constants/popcorn';
import { wrapTokens } from '../../../../lib/utils/tokens-helper';

export class AnimatableElement extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');

    this.state = {
      onSelect: props.onSelect,
      item: props.item,
    };

    this.removeAnimation = this.removeAnimation.bind(this);
  }

  removeAnimation(e, animationType) {
    e.stopPropagation();
    this.projectStore.updateAnimation(animationType);
  }

  getGridItem(animationType) {
    const { item } = this.state;
    const { activeElementId } = this.projectStore;
    const isViewCloseButton = activeElementId === item.i;

    switch (item.type) {
      case POPCORN_ELEMENT_TYPES.LEAD_GENERATOR:
      case POPCORN_ELEMENT_TYPES.TEXT:
      case POPCORN_ELEMENT_TYPES.IMAGE: {
        const animated = item.animation && item.animation[animationType]
          && item.animation[animationType].type !== NONE_CLASS;
        if (animated && isViewCloseButton) {
          return `<div class="${classnames('popcorn-element-part', { [\`${animationType}-animation-element\`]: animated })}"><button class="icon-button" onclick="this.removeAnimation(event, '${animationType}')">x</button></div>`;
        } else {
          return `<div class="${classnames('popcorn-element-part', { [\`${animationType}-animation-element\`]: animated })}"></div>`;
        }
      }
      default: {
        return '';
      }
    }
  }

  render() {
    const { onSelect, item } = this.state;

    const html = '<div class="popcorn-element" title="' + (item.type || item.title || item.htmlText) + '" tabindex="-1" onclick="' + (onSelect ? onSelect.name : '') + '">' +
      '<span class="popcorn-element-name">' +
        (item.htmlText ? '<span class="popcorn-element-text" contenteditable="true">' + wrapTokens(item.htmlText) + '</span>' : POPCORN_ELEMENT_LABELS[item.type]) +
      '</span>' +
      this.getGridItem(ANIMATION_TYPES.IN) +
      this.getGridItem(ANIMATION_TYPES.IDLE) +
      this.getGridItem(ANIMATION_TYPES.OUT) +
    '</div>';

    return this.createElementFromHTML(html);
  }
}
