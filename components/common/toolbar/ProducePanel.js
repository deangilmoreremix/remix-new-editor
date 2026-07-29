import { Component } from '../../base/Component.js';

export class ProducePanel extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      activeTab: null,
    };

    this.handleTabClick = this.handleTabClick.bind(this);
  }

  handleTabClick(label) {
    this.setState({ activeTab: label });
  }

  render() {
    const { items } = this.props;
    const activeTab = this.state.activeTab || (items && items[0] ? items[0].label : null);

    const activeTabItem = items.find(i => i.label === activeTab);
    const { renderer: Panel, items: panelItems = [] } = activeTabItem || {};

    const html = `
      <div class="container">
        <div class="tab-buttons">
          ${items.map(({ label }) => `
            <button
              key="${label}"
              data-tab-label="${label}"
              type="button"
            >
              <span class="toolbar-tab-title">${label}</span>
            </button>
          `).join('')}
        </div>
        ${Panel ? `<div class="panel-placeholder" data-panel="${Panel.name}"></div>` : ''}
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const buttons = element.querySelectorAll('button[data-tab-label]');
    buttons.forEach(button => {
      this.addEventListener(button, 'click', (e) => {
        const label = e.currentTarget.getAttribute('data-tab-label');
        this.handleTabClick(label);
      });
    });
  }
}

export default ProducePanel;