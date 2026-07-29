import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { editorStyles } from '../../../lib/constants/editorStyles.js';
import recorderItemsGenerator from '../../../lib/generators/recorderItemsGenerator.js';
import CloseButton from '../CloseButton.js';

export class Recorder extends Component {
  constructor(props = {}) {
    super(props);
    this.modalStore = getStore('modalStore');
    this.uiStore = getStore('uiStore');
    this.timelineStore = getStore('timelineStore');

    this.state = {
      useAudio: true,
      recorderItems: [],
    };

    this.handleClose = this.handleClose.bind(this);
    this.handleToggleAudio = this.handleToggleAudio.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.modalStore, () => this.updateRecorderItems());
    this.subscribeToStore(this.uiStore, () => this.forceUpdate());
    this.subscribeToStore(this.timelineStore, () => this.forceUpdate());
    this.updateRecorderItems();
  }

  updateRecorderItems() {
    const modalState = this.modalStore.getState();
    const { openModal, closeModal } = modalState;

    const items = recorderItemsGenerator({
      actions: {
        openModal,
        closeModal,
      },
      useAudio: this.state.useAudio,
    });

    this.setState({
      recorderItems: items && items.length ? items : []
    });
  }

  handleClose() {
    this.uiStore.setState({ rightBlockVisible: false });
  }

  handleToggleAudio() {
    this.setState({ useAudio: !this.state.useAudio }, () => {
      this.updateRecorderItems();
    });
  }

  render() {
    const timelineState = this.timelineStore.getState();
    const { timelineHeight } = timelineState;
    const libraryHeight = editorStyles.calculateHeight(timelineHeight);

    const { recorderItems, useAudio } = this.state;

    const html = `
      <div class="recorder" style="height: ${libraryHeight}px;">
        <div class="recorder__flex">
          <div class="recorder__header">
            <span>Recorder</span>
          </div>
          <div class="close-button-placeholder"></div>
        </div>
        <div class="recorder__body">
          <div class="recorder-panel">
            ${recorderItems.map(({ label, action, id, icon }) => `
              <button
                class="recorder-panel__button"
                type="button"
                key="${id}"
                data-action-id="${id}"
              >
                <div class="recorder-panel__icon">${icon}</div>
                ${label}
              </button>
            `).join('')}
            <div class="mute-btn">
              <label class="toggler">
                <input
                  type="checkbox"
                  ${useAudio ? 'checked' : ''}
                  class="audio-toggle"
                />
                <span class="toggler__label">Microphone</span>
              </label>
            </div>
          </div>
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

    const actionButtons = element.querySelectorAll('.recorder-panel__button');
    actionButtons.forEach(button => {
      this.addEventListener(button, 'click', (e) => {
        const actionId = e.currentTarget.getAttribute('data-action-id');
        const item = this.state.recorderItems.find(item => item.id === actionId);
        if (item && item.action) {
          item.action();
        }
      });
    });

    const audioToggle = element.querySelector('.audio-toggle');
    if (audioToggle) {
      this.addEventListener(audioToggle, 'change', this.handleToggleAudio);
    }
  }
}

export default Recorder;