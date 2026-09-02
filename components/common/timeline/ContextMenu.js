import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { contextButtons } from '../../../lib/constants/timelineContextMenu.js';

const buttonStyles = {
  height: 33,
};

const menuWidth = 200;

export class ContextMenu extends Component {
  constructor(props = {}) {
    super(props);
    this.timelineStore = getStore('timelineStore');
    this.copy = this.copy.bind(this);
  }

  copy() {
    this.timelineStore.setCopiedItems();
    this.timelineStore.setContextMenu({ isOpen: false });
  }

  render() {
    const { copiedItems, contextMenu } = this.timelineStore;

    const menuHeight = buttonStyles.height * contextMenu.buttons.length;
    let menuLeft = contextMenu.posX;
    if (window.innerWidth < contextMenu.posX + menuWidth) {
      menuLeft -= menuWidth;
    }

    const menuStyles = {
      width: menuWidth,
      left: menuLeft,
      top: contextMenu.posY - menuHeight,
      height: menuHeight,
    };

    const container = document.createElement('div');
    container.className = 'context-menu';
    Object.assign(container.style, menuStyles);

    if (contextMenu?.isClickOnRow && copiedItems?.length) {
      const pasteButton = document.createElement('button');
      pasteButton.className = 'context-menu__button';
      Object.assign(pasteButton.style, buttonStyles);
      pasteButton.textContent = contextButtons.PASTE;
      this.addEventListener(pasteButton, 'click', () => this.timelineStore.pasteElement());
      container.appendChild(pasteButton);
    } else {
      const copyButton = document.createElement('button');
      copyButton.className = 'context-menu__button';
      Object.assign(copyButton.style, buttonStyles);
      copyButton.textContent = contextButtons.COPY;
      this.addEventListener(copyButton, 'click', this.copy);
      container.appendChild(copyButton);
    }

    return container;
  }
}

export default ContextMenu;