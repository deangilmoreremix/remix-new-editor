import { Component } from '../../../../base/Component.js';
import FormSelect from '../../../../form/FormSelect.js';
import PropTypes from '../../../../../lib/PropTypes.js';
import PROVIDERS from '../../../../../lib/constants/campaigns/email-providers.js';

export class ServiceProvider extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      tooltip: false,
      selectedProvider: null,
    };
    this.linkElement = null;
  }

  onMount() {
    if (this.linkElement) {
      this.props.setLink(this.linkElement);
    }
  }

  handleCopyLink(e) {
    e.preventDefault();
    if (this.linkElement) {
      this.linkElement.select();
      document.execCommand('copy');
      this.linkElement.blur();
      this.handleShowTooltip();
    }
  }

  onSelectProvider(item) {
    this.setState({ selectedProvider: item.value });
    this.props.updateCampaign({ emailProvider: item });
  }

  handleShowTooltip() {
    if (!this.state.tooltip) {
      this.setState({ tooltip: true });
      this.setTimer(() => {
        this.setState({ tooltip: false });
      }, 800);
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'service-provider';

    const inner = document.createElement('div');
    inner.className = 'service-provider-inner';
    container.appendChild(inner);

    const section1 = document.createElement('div');
    section1.className = 'service-provider-section';
    inner.appendChild(section1);

    const span1 = document.createElement('span');
    span1.textContent = 'Select your Email Service Provider';
    section1.appendChild(span1);

    const inputBox = document.createElement('div');
    inputBox.className = 'search-input-box';
    section1.appendChild(inputBox);

    const span2 = document.createElement('span');
    span2.textContent = 'Select provider:';
    inputBox.appendChild(span2);

    const formSelect = new FormSelect({
      dataIsRequired: true,
      value: this.state.selectedProvider,
      items: PROVIDERS,
      onChange: this.onSelectProvider.bind(this),
    });
    inputBox.appendChild(formSelect.render());

    if (this.props.settings.emailProvider) {
      const section2 = document.createElement('div');
      section2.className = 'service-provider-section personalized-link-section';
      inner.appendChild(section2);

      const span3 = document.createElement('span');
      span3.textContent = 'Copy & Paste this PersonalizedLink™ into your email campaign';
      section2.appendChild(span3);

      const input = document.createElement('input');
      input.className = 'personalized-link';
      input.type = 'text';
      input.value = this.props.generatePersonalizedLink();
      input.readOnly = true;
      input.title = 'Double click to copy the link to clipboard';
      input.style.width = '100%';
      this.linkElement = input;
      this.addEventListener(input, 'click', (e) => { e.target.select(); });
      this.addEventListener(input, 'dblclick', this.handleCopyLink.bind(this));
      section2.appendChild(input);

      if (this.state.tooltip) {
        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip-copied';
        tooltip.textContent = 'Copied!';
        section2.appendChild(tooltip);
      }

      const p = document.createElement('p');
      p.className = 'personalized-link-copy';
      p.textContent = 'Double-click to copy';
      section2.appendChild(p);

      const section3 = document.createElement('div');
      section3.className = 'service-provider-section';
      inner.appendChild(section3);

      const span4 = document.createElement('span');
      span4.textContent = 'Send your Personalized email campaign';
      section3.appendChild(span4);
    }

    return container;
  }
}

ServiceProvider.propTypes = {
  settings: PropTypes.shape({
    emailProvider: PropTypes.shape({
      key: PropTypes.string.isRequired,
    }),
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  generatePersonalizedLink: PropTypes.func.isRequired,
  setLink: PropTypes.func.isRequired,
};

export default ServiceProvider;