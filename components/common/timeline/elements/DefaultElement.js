import { Component } from '../../../../base/Component.js';
import { POPCORN_ELEMENT_LABELS } from '../../../../lib/constants/popcorn';
import { wrapTokens } from '../../../../lib/utils/tokens-helper';

export class DefaultElement extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      item: props.item,
    };
  }

  render() {
    const { item } = this.state;

    const html = `
      <div class="popcorn-element" tabindex="-1" title="${item.type || item.title || item.htmlText}">
        <span class="popcorn-element-name">
          ${item.htmlText ? `<span class="popcorn-element-text" contenteditable="true">${wrapTokens(item.htmlText)}</span>` : POPCORN_ELEMENT_LABELS[item.type]}
        </span>
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}
