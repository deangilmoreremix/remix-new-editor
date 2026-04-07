import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { editorStyles } from '../../../lib/constants/editorStyles.js';
import { WINDOW_TYPES, TOOLBARS } from '../../../lib/constants/ui.js';
import AnimatedWindow from '../AnimatedWindow.js';
import HelpIconComponent from '../HelpIcon.js';

export class Toolbar extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');
    this.userStore = getStore('userStore');
    this.timelineStore = getStore('timelineStore');

    this.state = {
      activeTab: null,
    };

    this.handleTabClick = this.handleTabClick.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.uiStore, () => this.updateFromUI());
    this.subscribeToStore(this.userStore, () => this.updateFromUser());
    this.subscribeToStore(this.timelineStore, () => this.updateFromTimeline());
  }

  updateFromUI() {
    // Handle UI store changes
    const { toolbarItem } = this.uiStore.getState();
    if (toolbarItem && toolbarItem.id && !this.state.activeTab) {
      this.setState({ activeTab: toolbarItem.id });
    }
    this.forceUpdate();
  }

  updateFromUser() {
    // Handle user store changes
    this.forceUpdate();
  }

  updateFromTimeline() {
    // Handle timeline store changes
    this.forceUpdate();
  }

  handleTabClick(tabId, func) {
    const uiState = this.uiStore.getState();
    const { secondaryWindowType, isCanvasPresent } = uiState;

    if ((secondaryWindowType !== WINDOW_TYPES.TEXT_TO_SPEECH && !isCanvasPresent)
      || tabId !== TOOLBARS.MEDIA) {
      this.uiStore.setState({ isCanvasPresent: true });
    }

    if ((secondaryWindowType === WINDOW_TYPES.TEXT_TO_SPEECH
      || secondaryWindowType === WINDOW_TYPES.IMAGE
      || secondaryWindowType === WINDOW_TYPES.VIDEO
      || secondaryWindowType === WINDOW_TYPES.AUDIO) && !isCanvasPresent) {
      this.uiStore.setState({ rightBlockVisible: false });
    }

    func();
    this.uiStore.setState({ toolbarItem: { id: tabId } });
    this.setState({ activeTab: tabId });
  }

  render() {
    const items = this.props.items || [];
    const userState = this.userStore.getState();
    const { videoAutomationCreatorEnabled } = userState;

    let filteredItems = items;
    if (videoAutomationCreatorEnabled === false) {
      filteredItems = items.filter((e) => e.id !== 'template-generator');
    }

    const uiState = this.uiStore.getState();
    const { toolbarItem, isExpand } = uiState;
    const timelineState = this.timelineStore.getState();
    const { timelineHeight } = timelineState;

    const libraryHeight = editorStyles.calculateHeight(timelineHeight - editorStyles.toolbar.differencePX);

    const { id } = toolbarItem || {};
    const { items: tabContent = [], renderer: TabRenderer } = filteredItems.find(i => i.id === (this.state.activeTab || id)) || {};

    const html = `
      <div class="toolbar-container" style="height: ${libraryHeight}px;">
        <div class="toolbar-tabs">
          ${filteredItems.map(({ label, icon, id: tabId, func, tooltip }) => `
            <button
              class="toolbar-tab"
              key="${label}"
              data-tab-id="${tabId}"
              type="button"
            >
              <div class="toolbar-box">
                <div class="toolbar-tab-icon">${icon}</div>
                <span class="toolbar-tab-title">${label}</span>
              </div>
              ${isExpand ? `
                <div class="toolbar-arrow">
                  ${tabId !== TOOLBARS.TEMPLATE_GEN ? '<div class="toolbar-arrow-icon"></div>' : ''}
                </div>
              ` : ''}
            </button>
          `).join('')}
        </div>
        ${TabRenderer ? `<div class="tab-renderer" data-renderer="${TabRenderer.name}"></div>` : ''}
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const tabButtons = element.querySelectorAll('.toolbar-tab');
    tabButtons.forEach(button => {
      this.addEventListener(button, 'click', (e) => {
        const tabId = e.currentTarget.getAttribute('data-tab-id');
        const item = this.props.items.find(i => i.id === tabId);
        if (item && item.func) {
          this.handleTabClick(tabId, item.func);
        }
      });
    });
  }
}

export default Toolbar;