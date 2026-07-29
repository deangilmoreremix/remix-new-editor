import { Component } from '../base/Component.js';
import { PAYMENT_URL } from '../../lib/constants/features.js';

const goToPayment = () => window.open(PAYMENT_URL);

export class UnauthorizedView extends Component {
  constructor(props = {}) {
    super(props);
    this.goToPayment = this.goToPayment.bind(this);
  }

  goToPayment() {
    goToPayment();
  }

  render() {
    const container = document.createElement('div');
    container.className = 'unathorized-view__screen';

    // Assume UnauthorizedViewIcon is SVG string
    const icon = document.createElement('div');
    icon.className = 'unathorized-view__icon';
    icon.innerHTML = `<svg>...</svg>`; // Placeholder for UnauthorizedViewIcon
    container.appendChild(icon);

    const textMain = document.createElement('p');
    textMain.className = 'text-main';
    textMain.textContent = 'Unable to access content';
    container.appendChild(textMain);

    const textMessage = document.createElement('p');
    textMessage.className = 'text-message';
    textMessage.innerHTML = 'You don&#39;t have enough rights to use this editor.';
    container.appendChild(textMessage);

    const button = document.createElement('button');
    button.className = 'go-to-payment_button';
    button.textContent = 'Go to payment';
    this.addEventListener(button, 'click', this.goToPayment);
    container.appendChild(button);

    return container;
  }
}

export default UnauthorizedView;