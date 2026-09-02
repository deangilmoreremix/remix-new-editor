import classnames from 'classnames';
import Component from '../base/Component';

export class SettingsHeader extends Component {
  constructor(props = {}) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(newValue) {
    const { activeTab, setTab } = this.props;
    if (newValue === activeTab) {
      return;
    }
    if (setTab) {
      setTab(newValue);
    }
  }

  render() {
    const {
      className,
      tabs,
      activeTab,
      title,
      onCloseWindow,
      closeButton,
      handleClose,
      isExtendCloseButton,
      allowedMultiButton,
    } = this.props;

    const div = document.createElement('div');
    div.className = classnames(className, 'header-tabs');

    if (title) {
      const p = document.createElement('p');
      p.className = 'header-tabs__title';
      p.textContent = title;
      div.appendChild(p);
    }

    if (tabs && tabs[activeTab]) {
      tabs.forEach((tab, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = classnames('header-tabs__item', { 'header-tabs__item--active': activeTab === i });
        button.disabled = tab.disabled;
        button.addEventListener('click', () => this.handleChange(i));

        if (tab.icon) {
          const iconDiv = document.createElement('div');
          iconDiv.className = classnames('tab-icon', { 'tab-icon-active': activeTab === i });
          iconDiv.innerHTML = tab.icon; // Assume SVG string
          button.appendChild(iconDiv);
        }

        button.appendChild(document.createTextNode(tab.label));
        div.appendChild(button);
      });
    }

    if (tabs) {
      const closeBtn = document.createElement('button');
      closeBtn.className = isExtendCloseButton ? 'close-button-extend' : 'close-button';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', closeButton ? handleClose : onCloseWindow);
      div.appendChild(closeBtn);
    }

    return div;
  }
}

export default SettingsHeader;
