import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { SECTIONS } from '../../../lib/constants/settings.js';
import AnimatedWindow from '../AnimatedWindow.js';
import CloseButton from '../CloseButton.js';
import Element from './Element.js';

export class ElementsPanel extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');

    this.state = {
      personalizationElements: [],
      leadGenElements: [],
      advancedElements: [],
      creativeElements: [],
      videoControlElements: [],
    };

    this.handleClose = this.handleClose.bind(this);
    this.handleElementClick = this.handleElementClick.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.uiStore, () => this.forceUpdate());
  }

  handleClose() {
    this.uiStore.setState({ leftBlockVisible: false });
  }

  handleElementClick(action) {
    this.uiStore.setState({ rightBlockVisible: true });
    action();
  }

  render() {
    const { items } = this.props;
    const uiState = this.uiStore.getState();
    const { checkboxLeft, prevStateProduce } = uiState;

    if (!checkboxLeft || prevStateProduce) {
      this.uiStore.setState({ prevStateProduce: false });
      return null;
    }

    // Filter elements
    const personalizationElements = items.filter(({ uiSection, adminElement }) =>
      uiSection === SECTIONS.basic && adminElement);
    const leadGenElements = items.filter(({ uiSection }) =>
      uiSection === SECTIONS.leadGeneration);
    const advancedElements = items.filter(({ uiSection }) =>
      uiSection === SECTIONS.advanced);
    const creativeElements = items.filter(({ uiSection }) =>
      uiSection === SECTIONS.creative);
    const videoControlElements = items.filter(({ uiSection }) =>
      uiSection === SECTIONS.videoControl);

    const elementsRenderer = (elements) => elements.map(item => {
      const elementComponent = new Element({
        item,
        onClick: this.handleElementClick
      });
      return elementComponent.render().outerHTML;
    }).join('');

    const html = `
      <div class="animated-window-wrapper">
        <div class="elements-panel-container">
          <div class="elements-panel-inner-row">
            ${personalizationElements.length ? `<h3 class="elements-panel-section__title">Personalization</h3>${elementsRenderer(personalizationElements)}` : ''}
            ${creativeElements.length ? `<h3 class="elements-panel-section__title">Creative</h3>${elementsRenderer(creativeElements)}` : ''}
            ${videoControlElements.length ? `<h3 class="elements-panel-section__title">Video Controls</h3>${elementsRenderer(videoControlElements)}` : ''}
            ${leadGenElements.length ? `<h3 class="elements-panel-section__title">Lead Generation</h3>${elementsRenderer(leadGenElements)}` : ''}
            ${advancedElements.length ? `<h3 class="elements-panel-section__title">Advanced Tools / Add-ons</h3>${elementsRenderer(advancedElements)}` : ''}
          </div>
          <div class="close-button-placeholder"></div>
        </div>
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const closeButton = element.querySelector('.close-button-placeholder');
    if (closeButton) {
      const closeBtn = new CloseButton({ onClick: this.handleClose });
      closeButton.parentNode.replaceChild(closeBtn.render(), closeButton);
    }
  }
}

export default ElementsPanel;