import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';

export class PassportMakerModal extends Component {
  constructor(props = {}) {
    super(props);
  }

  render() {
    const { handleClose, options } = this.props;
    const html = `<div class="image-editor-modal"><div>Passport Maker Content</div></div>`;
    const element = this.createElementFromHTML(html);
    return element;
  }
}