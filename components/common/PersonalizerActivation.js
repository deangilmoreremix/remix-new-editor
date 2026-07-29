import { Component } from '../../base/Component.js';
import { getStore } from '../../stores/base/Store.js';
import FieldBuilder from '../form/FieldBuilder.js';
import personalizerIcon from '../../public/static/svgImages/personalizer.svg';
import { SHOW_LB } from '../../lib/constants/text-info';

export class PersonalizerActivation extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');

    this.state = {
      marginLeft: props.marginLeft,
      togglePersonalizer: props.togglePersonalizer,
    };
  }

  render() {
    const { marginLeft, togglePersonalizer } = this.state;
    const { retarget, showedRetarget } = this.projectStore;

    if (!retarget.kind) {
      return null;
    }

    const personalizerLabel = SHOW_LB[retarget.kind] || '';

    const fieldBuilder = new FieldBuilder({
      type: 'checkbox',
      label: personalizerLabel,
      value: showedRetarget,
      onChange: () => togglePersonalizer(!showedRetarget),
      name: 'personalizer',
      floatClassName: 'personalizer-field',
    });

    const html = `
      <div class="personalizer-activation" style="${marginLeft ? `margin-left: ${marginLeft}` : ''}">
        <div class="personalizer-icon">${personalizerIcon}</div>
        ${fieldBuilder.render().outerHTML}
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}
