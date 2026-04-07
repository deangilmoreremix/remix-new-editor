import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import classnames from 'classnames';
import { showInfo, showNotice } from '../../../lib/services/alertService';
import HelpIconComponent from '../HelpIcon.js';

export class ProducePanel extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.userStore = getStore('userStore');

    this.state = {
      items: props.items,
      tab: props.tab,
      setActiveTab: props.setActiveTab,
      isCopied: false,
    };

    this.onCLick = this.onCLick.bind(this);
    this.handleShowTooltip = this.handleShowTooltip.bind(this);
    this.svgButton = this.svgButton.bind(this);
  }

  onCLick(action, isActive, errorMessage, url, copiedTooltip, label) {
    const { item } = this.projectStore;
    const { publishEnabled } = this.userStore;
    const { setActiveTab, tab } = this.state;

    if (publishEnabled && item.published == undefined && label !== 'Copy playback link') {
      let message = 'Please save the project first!!';
      showNotice(message);
      setActiveTab(tab);
      return false;
    }
    if (label == 'Copy playback link' && item.published === false) {
      let message = 'Please publish your project before copying the link';
      showNotice(message);
      setActiveTab(tab);
      return false;
    }
    if (item.published === false) {
      let message = 'Please publish the project first!!';
      showNotice(message);
      setActiveTab(tab);
      return false;
    }
    if (url && !isActive) {
      showInfo(errorMessage);
      setActiveTab(tab);
    }
    if (isActive) {
      if (!url) {
        action();
      }
      if (url && copiedTooltip) {
        action(url);
        this.handleShowTooltip();
      }
    } else {
      showInfo(errorMessage);
      setActiveTab(tab);
    }
  }

  handleShowTooltip() {
    if (!this.state.isCopied) {
      this.setState({ isCopied: true });
      setTimeout(() => this.setState({ isCopied: false }), 800);
    }
  }

  svgButton(label, action, isActive, errorMessage, icon, tooltip, url, copiedTooltip) {
    const { isCopied } = this.state;

    const helpIcon = new HelpIconComponent({ noIcon: true, message: tooltip });

    const html = `
      <button type="button" class="${classnames('produce-panel__button', { 'produce-panel__button--unactive': !isActive })}" onclick="this.onCLick(${action.name}, ${isActive}, '${errorMessage}', '${url}', '${copiedTooltip}', '${label}')">
        ${helpIcon.render().outerHTML}
        <div class="produce-panel__button">
          <div class="produce-panel__icon">${icon}</div>
          ${label}
          ${isCopied && copiedTooltip ? `<p class="personalized-link-copy">${copiedTooltip}</p>` : ''}
        </div>
      </button>
    `;

    return this.createElementFromHTML(html);
  }

  render() {
    const { items } = this.state;
    const { item } = this.projectStore;

    const div = document.createElement('div');
    div.className = 'produce-block produce-panel';

    items.forEach(({
      label,
      action,
      icon,
      tooltip,
      isActive,
      errorMessage,
      url,
      copiedTooltip,
    }) => {
      if (isActive && url && !copiedTooltip && item.published) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.appendChild(this.svgButton(label, action, isActive, errorMessage, icon, tooltip, url, copiedTooltip));
        div.appendChild(a);
      } else {
        div.appendChild(this.svgButton(label, action, isActive, errorMessage, icon, tooltip, url, copiedTooltip));
      }
    });

    return div;
  }
}
