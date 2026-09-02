import { Component } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import { uiStore } from '../../../stores';

import { STICKERS_TABS } from '../../../lib/constants/stickers';

const Tabs = observer(class extends Component {
  constructor(props = {}) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }
  
  handleClick(value) {
    uiStore.setSecondaryWindowType(value);
  }
  
  render() {
    const { secondaryWindowType: activeTab } = uiStore;
    const html = `
      <div class="stickers-tabs">
        ${Object.keys(STICKERS_TABS).map(item => `
          <button class="stickers-tab ${STICKERS_TABS[item].value === activeTab ? 'stickers-tab-active' : ''}" data-value="${STICKERS_TABS[item].value}">
            ${STICKERS_TABS[item].label}
          </button>
        `).join('')}
      </div>
    `;
    const element = this.createElementFromHTML(html);
    element.querySelectorAll('.stickers-tab').forEach(button => {
      this.addEventListener(button, 'click', () => this.handleClick(button.dataset.value));
    });
    return element;
  }
});

export default Tabs;
