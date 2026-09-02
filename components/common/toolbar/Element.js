import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { acceptedDraggableItems } from '../../../lib/constants/dragNDropConstants.js';
import { FEATURES } from '../../../lib/constants/campaigns/constants.js';

export class Element extends Component {
  constructor(props = {}) {
    super(props);
    this.userStore = getStore('userStore');

    this.state = {
      isDragging: false,
    };

    this.handleClick = this.handleClick.bind(this);
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleImageClick = this.handleImageClick.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.userStore, () => this.forceUpdate());
  }

  async handleImageClick() {
    const { item } = this.props;
    const featureDetails = FEATURES.find(ele => ele.label.trim() === item.label.trim());
    if (featureDetails) {
      const userState = this.userStore.getState();
      const tempUpgradeLink = await userState.getUpgradeLinkRole(featureDetails.name, featureDetails.envName, featureDetails.revName);
      if (tempUpgradeLink) {
        window.open(tempUpgradeLink, '_blank');
      }
    }
  }

  handleClick() {
    const { item, onClick } = this.props;
    const { action, disabled } = item;

    if (disabled) {
      this.handleImageClick();
    } else {
      onClick(action);
    }
  }

  handleDragStart(e) {
    const { item } = this.props;
    const { label, action } = item;

    // Set drag data
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: label, action }));
    this.setState({ isDragging: true });
  }

  render() {
    const { item } = this.props;
    const { label, icon, disabled } = item;

    const isDraggable = acceptedDraggableItems.includes(label);

    const html = `
      <div class="element-container">
        <button
          class="elements-panel-button ${isDraggable ? 'draggable' : ''}"
          type="button"
          ${disabled ? 'data-disabled="true"' : ''}
        >
          <div class="elements-panel-icon">${icon}</div>
          <span class="elements-panel-label">${label}</span>
          ${disabled ? '<img class="pro-icon" src="/static/images/pro.png" alt="Pro" />' : ''}
        </button>
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const button = element.querySelector('.elements-panel-button');
    if (button) {
      this.addEventListener(button, 'click', this.handleClick);

      const { item } = this.props;
      if (acceptedDraggableItems.includes(item.label)) {
        this.addEventListener(button, 'dragstart', this.handleDragStart);
        button.setAttribute('draggable', 'true');
      }
    }
  }
}

export default Element;