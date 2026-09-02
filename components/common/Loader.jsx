import { Component } from '../base/Component.js';
import classnames from 'classnames';
import { LOADING_COLOR } from '../../lib/constants/ui.js';

class Loader extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      size: 100,
      fixed: false,
      ...props
    };
  }

  render() {
    const container = document.createElement('div');
    container.className = classnames('loading-spinner', this.props.className, {
      fixed: this.props.fixed,
      active: this.props.isLoading,
      preloader: this.props.preloader
    });

    if (this.props.isLoading) {
      const spinner = document.createElement('div');
      spinner.style.cssText = `
        width: ${this.props.size}px;
        height: ${this.props.size}px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid ${this.props.color || LOADING_COLOR};
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: auto;
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 10000;
      `;

      // Add keyframes if not present
      if (!document.querySelector('#spin-keyframes')) {
        const style = document.createElement('style');
        style.id = 'spin-keyframes';
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }

      container.appendChild(spinner);
    }

    return container;
  }
}

export default Loader;
