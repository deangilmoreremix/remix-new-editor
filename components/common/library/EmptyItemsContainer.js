import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';

export class EmptyItemsContainer extends Component {
  constructor(props = {}) {
    super(props);
  }

  render() {
    const { count } = this.props;
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(i);
    }
    const items = arr.map(item => `<div class="library__item" key="${item}"></div>`).join('');
    const html = `<div>${items}</div>`;
    const element = this.createElementFromHTML(html);
    return element;
  }
}