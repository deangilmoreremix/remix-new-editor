import { Component } from '../../base/Component.js';
import classnames from 'classnames';

// Inline close icon SVG
const closeIcon = `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.83 9.83"><defs><style>.cls-1{fill:#fff;}</style></defs><path class="cls-1" d="M965.1,543.68l-3.19-3.18,3.19-3.18a1,1,0,0,0-1.42-1.42l-3.18,3.19-3.18-3.19a1,1,0,0,0-1.42,1.42l3.19,3.18-3.19,3.18a1,1,0,0,0,1.42,1.42l3.18-3.19,3.18,3.19a1,1,0,0,0,1.42-1.42Z" transform="translate(-955.59 -535.59)"/></svg>`;

class SnackBar extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      message: props.message,
      handleClose: props.handleClose,
      className: props.className,
      contentClassName: props.contentClassName,
      autoHideDuration: props.autoHideDuration || 4000,
      autoClose: props.autoClose || false
    };
    this.autoHideTimer = null;
  }

  onMount() {
    if (this.props.autoClose && this.props.message) {
      this.autoHideTimer = this.setTimer(() => {
        this.props.handleClose();
      }, this.props.autoHideDuration);
    }
  }

  onUnmount() {
    if (this.autoHideTimer) {
      this.clearTimer(this.autoHideTimer);
    }
  }

  render() {
    if (!this.props.message) return null;

    const container = document.createElement('div');
    container.className = classnames('snackbar', this.props.className);
    container.setAttribute('role', 'alert');
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #333;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const messageSpan = document.createElement('span');
    messageSpan.id = 'snackbar-fab-message-id';
    messageSpan.textContent = this.props.message;
    container.appendChild(messageSpan);

    const button = document.createElement('button');
    button.className = 'icon-button';
    button.innerHTML = closeIcon;
    button.style.cssText = `
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 0;
    `;
    this.addEventListener(button, 'click', () => this.props.handleClose(null));
    container.appendChild(button);

    return container;
  }
}

export default SnackBar;
