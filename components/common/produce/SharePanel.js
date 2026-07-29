import { Component } from '../../../base/Component.js';

export class SharePanel extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      items: props.items,
    };
  }

  render() {
    const { items } = this.state;

    const html = items.map(({ label, action }) => `
      <button type="button" onclick="${action.name}">${label}</button>
    `).join('');

    return this.createElementFromHTML(`<div>${html}</div>`);
  }
}
