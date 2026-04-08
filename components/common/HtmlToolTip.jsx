import { Component } from '../base/Component.js';
import classnames from 'classnames';

const helpIcon = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 6.5C12.5 9.81371 9.81371 12.5 6.5 12.5C3.18629 12.5 0.5 9.81371 0.5 6.5C0.5 3.18629 3.18629 0.5 6.5 0.5C9.81371 0.5 12.5 3.18629 12.5 6.5Z" stroke="#575773"/><path d="M6.99464 8.35002H6.07189V7.57648C6.07189 6.72835 6.59805 6.4849 7.19489 6.18255H7.18704C7.5365 5.99408 7.89382 5.78597 7.91345 5.22054C7.93308 4.62763 7.43441 4.02294 6.52737 4.02294C5.87557 4.02294 5.34941 4.43916 5.04706 5.05956L4.31279 4.62763C4.71723 3.75986 5.4515 3.08057 6.52737 3.08057C8.05481 3.08057 8.93829 4.12503 8.92258 5.24803C8.89509 6.37103 8.18831 6.70871 7.5954 7.03069C7.29306 7.19168 6.99071 7.32126 6.99071 7.58826L6.99464 8.35002ZM7.14385 9.25313C7.14385 9.54369 6.88862 9.85782 6.52345 9.85782C6.19362 9.85782 5.93054 9.54762 5.93054 9.25313C5.93054 8.88403 6.19362 8.63273 6.52345 8.63273C6.89255 8.63273 7.14385 8.88796 7.14385 9.25313Z" fill="#9292B5"/></svg>`;

const defaultTitle = `<em>For 360 videos, we recommend using only videos downloaded from your computer. You can use</em> <a href='http://download.vidcloud.io/' target='blank'>our downloader</a>`;

class TooltipProvider extends Component {
  constructor(props) {
    super(props);
    this.tooltipElement = null;
    this.showTimeout = null;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.appendChild(this.props.children);

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'tooltip html-tooltip';
    this.tooltipElement.style.cssText = `
      position: absolute;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 0.5em;
      font-size: 12px;
      white-space: pre-wrap;
      text-align: center;
      border-radius: 4px;
      z-index: 1000;
      display: none;
      pointer-events: none;
    `;
    // Position based on placement
    switch (this.props.placement) {
      case 'top':
        this.tooltipElement.style.bottom = '100%';
        this.tooltipElement.style.left = '50%';
        this.tooltipElement.style.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        this.tooltipElement.style.top = '100%';
        this.tooltipElement.style.left = '50%';
        this.tooltipElement.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        this.tooltipElement.style.right = '100%';
        this.tooltipElement.style.top = '50%';
        this.tooltipElement.style.transform = 'translateY(-50%)';
        break;
      case 'right':
        this.tooltipElement.style.left = '100%';
        this.tooltipElement.style.top = '50%';
        this.tooltipElement.style.transform = 'translateY(-50%)';
        break;
    }
    this.tooltipElement.innerHTML = this.props.title || defaultTitle;

    wrapper.appendChild(this.tooltipElement);

    this.addEventListener(wrapper, 'mouseenter', () => {
      this.showTimeout = this.setTimer(() => {
        this.tooltipElement.style.display = 'block';
      }, this.props.isDelay ? 0 : 1000);
    });

    this.addEventListener(wrapper, 'mouseleave', () => {
      if (this.showTimeout) {
        this.clearTimer(this.showTimeout);
        this.showTimeout = null;
      }
      this.tooltipElement.style.display = 'none';
    });

    return wrapper;
  }
}

class HtmlToolTipComponent extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      placement: 'bottom',
      ...props
    };
  }

  render() {
    if (this.props.noIcon) {
      return new TooltipProvider({
        isDelay: this.props.noDelay,
        placement: this.props.placement,
        title: this.props.message
      }).render();
    } else {
      const container = document.createElement('div');
      container.className = classnames('help-icon', {
        'help-icon-project': this.props.projectCourses,
        'help-icon__input': this.props.isInput,
      });
      if (this.props.noPadding) {
        container.style.padding = '0';
      }

      const innerDiv = document.createElement('div');
      innerDiv.style.height = this.props.noPadding ? '35px' : `${this.props.height}px`;
      if (this.props.padding) {
        innerDiv.style.padding = this.props.padding;
      }

      const icon = document.createElement('div');
      icon.className = classnames('help-icon__icon', { 'help-icon__icon-white': this.props.whiteIcon });
      icon.innerHTML = helpIcon;

      const tooltipWrapper = new TooltipProvider({
        isDelay: this.props.noDelay,
        placement: this.props.placement,
        title: this.props.message
      }).render();

      tooltipWrapper.firstChild.innerHTML = helpIcon; // replace children
      tooltipWrapper.replaceChild(icon, tooltipWrapper.firstChild);

      innerDiv.appendChild(tooltipWrapper);
      container.appendChild(innerDiv);

      return container;
    }
  }
}

export default HtmlToolTipComponent;
