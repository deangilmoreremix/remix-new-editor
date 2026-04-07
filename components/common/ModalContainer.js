import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';

export class ModalContainer extends Component {
  constructor(props = {}) {
    super(props);
    this.modalStore = getStore('modalStore');
    this.userStore = getStore('userStore');
    this.handleClose = this.handleClose.bind(this);
    this.subscribeToStore(this.modalStore, () => this.update());
  }

  handleClose(id) {
    const modals = this.modalStore.getState().modals;
    const modal = modals.find(m => m.id === id);
    if (modal && modal.header && modal.header.onClose) {
      modal.header.onClose();
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    }
    // Assume closeModal method
    this.modalStore.getState().closeModal(id);
  }

  render() {
    const { classNameWL } = this.props;
    const { modalIds, modals, options } = this.modalStore.getState();
    const { hasPermissions } = this.userStore.getState();

    const modalsToShow = modals.filter(m => modalIds.has(m.id));

    const modalElements = modalsToShow.map((modal) => {
      const { id, className, renderer: ModalComponent, header, themeChange } = modal;
      const close = () => this.handleClose(id);
      const containerClass = `modal-container ${classNameWL || ''}`;
      const contentClass = `modal-container__content ${themeChange && !hasPermissions ? `${className}-white` : className}`;
      // Simplify header and content
      const headerHtml = header ? `<div class="modal-header">${header.title || ''}</div>` : '';
      const contentHtml = `<div class="${contentClass}"><div>Modal Content</div></div>`;
      return `<div class="${containerClass}" data-modal-id="${id}">${headerHtml}${contentHtml}</div>`;
    }).join('');

    const html = `<div>${modalElements}</div>`;
    const element = this.createElementFromHTML(html);
    return element;
  }
}