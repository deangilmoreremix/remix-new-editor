import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';
import guidelinesIcon from '../../public/static/svgImages/guidlines.svg';
import { mainTooltips } from '../../lib/constants/tooltips.js';
import HelpIconComponent from './HelpIcon.js';
import FieldBuilder from '../form/FieldBuilder.js';

export class GuidelinesActivation extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');

    this.handleToggle = this.handleToggle.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.uiStore, () => this.forceUpdate());
  }

  handleToggle() {
    const uiState = this.uiStore.getState();
    const { hasGuidLines } = uiState;
    this.uiStore.getState().setGuideLines(!hasGuidLines);
  }

  render() {
    const { marginLeft } = this.props;
    const uiState = this.uiStore.getState();
    const { hasGuidLines } = uiState;

    const html = `
      <div class="guidelines-activation" style="${marginLeft ? `margin-left: ${marginLeft};` : ''}">
        <div class="help-icon-placeholder"></div>
        <div class="field-builder-placeholder"></div>
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const helpIconPlaceholder = element.querySelector('.help-icon-placeholder');
    if (helpIconPlaceholder) {
      const helpIcon = new HelpIconComponent({
        noIcon: true,
        message: mainTooltips.guideline
      });
      const iconElement = helpIcon.render();
      const svgElement = document.createElement('div');
      svgElement.innerHTML = guidelinesIcon;
      svgElement.className = 'guidelines-icon';
      iconElement.appendChild(svgElement);
      helpIconPlaceholder.parentNode.replaceChild(iconElement, helpIconPlaceholder);
    }

    const fieldPlaceholder = element.querySelector('.field-builder-placeholder');
    if (fieldPlaceholder) {
      const field = new FieldBuilder({
        type: 'checkbox',
        label: 'Guideline',
        value: this.uiStore.getState().hasGuidLines,
        onChange: this.handleToggle,
        name: 'guidelines',
        floatClassName: 'guidelines-field'
      });
      fieldPlaceholder.parentNode.replaceChild(field.render(), fieldPlaceholder);
    }
  }
}

export default GuidelinesActivation;