import { Component } from '../base/Component.js';
import { mainTooltips } from '../../lib/constants/tooltips.js';
import HelpIconComponent from './HelpIcon.js';
import FieldBuilder from '../form/FieldBuilder.js';

class GuidelinesActivation extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      marginLeft: '',
      ...props
    };
  }

  render() {
    const container = document.createElement('div');
    container.className = 'guidelines-activation';

    if (this.props.marginLeft) {
      container.style.marginLeft = this.props.marginLeft;
    }

    // Create SVG icon element
    const svgIcon = document.createElement('div');
    svgIcon.className = 'guidelines-icon';
    // Note: SVG content would need to be imported and injected here
    // For now, using placeholder
    svgIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 6h4v4H8zM8 12h4v2H8z"/></svg>';

    const helpIcon = new HelpIconComponent({
      noIcon: true,
      message: mainTooltips.guideline,
      children: svgIcon
    }).render();

    container.appendChild(helpIcon);

    const fieldBuilder = new FieldBuilder({
      type: 'checkbox',
      label: 'Guideline',
      value: false, // TODO: Connect to UI store
      onChange: () => {
        // TODO: Connect to UI store setGuideLines
        console.log('Guidelines toggle clicked');
      },
      name: 'guidelines',
      floatClassName: 'guidelines-field'
    }).render();

    container.appendChild(fieldBuilder);

    return container;
  }
}

export default GuidelinesActivation;
