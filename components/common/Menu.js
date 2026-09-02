import { Component } from '../base/Component.js';
import Shortcuts from './Shortcuts.js';
import HelpIconComponent from './HelpIcon.js';

export class Menu extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      open: false,
      showShortcut: false,
    };
    this.anchorRef = null;
    this.handleToggle = this.handleToggle.bind(this);
    this.handleClickAway = this.handleClickAway.bind(this);
    this.listItemClick = this.listItemClick.bind(this);
    this.handleAction = this.handleAction.bind(this);
  }

  handleToggle() {
    this.setState({ open: !this.state.open });
  }

  handleClickAway() {
    this.setState({ open: false });
  }

  handleAction(arg) {
    if (arg === 'SHORTCUT_ACTIONS') {
      this.setState({ showShortcut: true });
    }
    if (arg === 'ACTION_LOGOUT') {
      if (window.HelpCrunch) {
        window.HelpCrunch(arg);
      }
      window.location.href = '/logout';
    }
  }

  listItemClick(buttonItem) {
    if (this.props.onClick) {
      this.props.onClick(buttonItem.value);
    } else {
      this.handleAction(buttonItem.action);
    }
    this.setState({ open: !this.state.open });
  }

  onMount() {
    this.addDocumentListener('click', this.handleClickAway);
  }

  onUnmount() {
    // Document listeners are cleaned up automatically
  }

  render() {
    const { toggleElement, items, className, needEndIcon, placement, useButton, lineDropIcon } = this.props;
    const { open, showShortcut } = this.state;

    const container = document.createElement('div');
    container.className = className || '';

    // Toggle button
    const toggleButton = document.createElement(useButton ? 'button' : 'button'); // Button is fine
    toggleButton.className = 'menu__open';
    toggleButton.setAttribute('aria-haspopup', 'true');
    toggleButton.setAttribute('aria-expanded', open);
    this.addEventListener(toggleButton, 'click', this.handleToggle);
    this.anchorRef = toggleButton;

    // Toggle element
    if (typeof toggleElement === 'string') {
      toggleButton.textContent = toggleElement;
    } else if (toggleElement) {
      toggleButton.appendChild(toggleElement);
    }

    // End icon
    if (needEndIcon) {
      const icon = document.createElement('span');
      icon.className = 'toggler-icon';
      // Assume SVG is inline or use img
      icon.innerHTML = `<svg>...</svg>`; // Placeholder for togglerIcon
      toggleButton.appendChild(icon);
    }

    container.appendChild(toggleButton);

    // Shortcuts
    if (showShortcut) {
      const shortcuts = new Shortcuts({ showShortcut, setShowShortcut: (val) => this.setState({ showShortcut: val }) });
      container.appendChild(shortcuts.render());
    }

    // Dropdown
    if (open) {
      const dropdown = document.createElement('div');
      dropdown.className = 'menu__list popover';
      dropdown.style.position = 'absolute';
      dropdown.style.zIndex = '1000';
      // Position based on anchorRef
      if (this.anchorRef) {
        const rect = this.anchorRef.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.left = `${rect.left}px`;
      }

      items.forEach(item => {
        let linkElement;
        if (item.url) {
          linkElement = document.createElement(item.isLink ? 'a' : 'a');
          linkElement.href = item.isLink ? item.url : `//${item.url}`;
          if (!item.isLink) linkElement.target = '_blank';
        } else {
          linkElement = document.createElement('div');
        }

        const button = document.createElement('button');
        button.className = 'menu__item';
        this.addEventListener(button, 'click', () => this.listItemClick(item));

        if (item.icon) {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'menu__item-icon';
          iconSpan.innerHTML = item.icon; // Assume SVG string
          button.appendChild(iconSpan);
        }

        button.appendChild(document.createTextNode(item.title));

        if (item.isTooltip) {
          const helpIcon = new HelpIconComponent({
            whiteIcon: true,
            projectCourses: item.tooltip.includes('Strategy'),
            placement: 'left-end',
            height: 25,
            message: item.tooltip,
          });
          button.appendChild(helpIcon.render());
        }

        linkElement.appendChild(button);
        dropdown.appendChild(linkElement);
      });

      container.appendChild(dropdown);
    }

    return container;
  }
}

export default Menu;