import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';

const arrowIcon = `<svg width="15" height="23" viewBox="0 0 15 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.8 22.128C12.4 22.128 12 22.028 11.6 21.728L1 13.128C0.4 12.628 0 11.928 0 11.028C0 10.228 0.4 9.52796 1 9.02796L11.7 0.427956C12.5 -0.272044 13.7 -0.0720444 14.4 0.727956C15.1 1.52796 14.9 2.72796 14.1 3.42796L4.5 11.028L14 18.728C14.8 19.428 14.9 20.628 14.3 21.428C13.9 21.828 13.4 22.128 12.8 22.128Z" fill="#3E3E51"/></svg>`;

export class CloseButton extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      isTabs: false,
      allowedMultiButton: true,
      ...props
    };
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  render() {
    const className = `${this.props.className || 'close-button'} ${this.props.isTabs && this.props.allowedMultiButton ? 'multi-close-button' : ''}`;
    const html = `<button class="${className}" aria-label="Close">${arrowIcon}</button>`;
    const element = this.createElementFromHTML(html);
    this.addEventListener(element, 'click', this.handleClick);
    return element;
  }
}
