import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';

export class PersonalizeButton extends Component {
  constructor(props = {}) {
    super(props);
    this.modalStore = getStore('modalStore');
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    const { elementType, onAdd, tokenModes } = this.props;
    const { openModal } = this.modalStore.getState();
    openModal('PERSONALIZATION_MODAL', { elementType, onAdd, tokenModes });
  }

  render() {
    const { className, disabled, text = 'Personalize' } = this.props;
    const containerClass = `personalize-container ${className || ''}`;
    const buttonClass = `btn-personalize ${disabled ? 'btn-personalize-disabled' : ''}`;
    const html = `
      <div class="${containerClass}">
        <button class="${buttonClass}" ${disabled ? 'disabled' : ''}>${text}</button>
      </div>
    `;
    const element = this.createElementFromHTML(html);
    if (!disabled) {
      const button = element.querySelector('button');
      this.addEventListener(button, 'click', this.handleClick);
    }
    return element;
  }
}

export default PersonalizeButton;