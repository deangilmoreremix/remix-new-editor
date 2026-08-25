import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import classnames from 'classnames';
import AnimatedWindow from '../AnimatedWindow.js';
import CloseButton from '../CloseButton.js';

export class Produce extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');

    this.state = {
      activeTab: null,
    };

    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.uiStore, () => this.forceUpdate());
  }

  handleTabClick(tabId) {
    this.setState({ activeTab: tabId });
  }

  handleClose() {
    this.uiStore.setState({ produceWindowOpen: false });
  }

  render() {
    const { items, options: { tab, ...options } = {} } = this.props;
    const defaultTab = tab || (items && items[0] ? items[0].id : null);
    const activeTab = this.state.activeTab || defaultTab;

    const uiState = this.uiStore.getState();
    const { radioButtonBottom, checkboxLeft } = uiState;

    if (!radioButtonBottom) {
      return null;
    }

    const activeTabItem = items.find(i => i.id === activeTab);
    const { renderer: Panel, items: panelItems = [] } = activeTabItem || {};

    const html = `
      <div class="animated-window-wrapper">
        ${AnimatedWindow ? '<div class="animated-window-placeholder"></div>' : ''}
        <div class="produce">
          <div class="produce__tabs">
            ${items.map(({ label, id }) => `
              <button
                key="${label}"
                data-tab-id="${id}"
                type="button"
                class="produce__tab ${activeTabItem && activeTabItem.id === id ? 'produce__tab-active' : ''}"
              >
                <span class="toolbar__tab-title">${label}</span>
              </button>
            `).join('')}
            <div class="close-button-placeholder"></div>
          </div>
          ${Panel ? `<div class="panel-placeholder" data-panel="${Panel.name}"></div>` : ''}
        </div>
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const tabButtons = element.querySelectorAll('.produce__tab');
    tabButtons.forEach(button => {
      this.addEventListener(button, 'click', (e) => {
        const tabId = e.currentTarget.getAttribute('data-tab-id');
        this.handleTabClick(tabId);
      });
    });

    const closeButton = element.querySelector('.close-button-placeholder');
    if (closeButton) {
      // Assume CloseButton component handles its own events
      const closeBtn = new CloseButton({ onClick: this.handleClose });
      closeButton.parentNode.replaceChild(closeBtn.render(), closeButton);
    }
  }
}

export default Produce;