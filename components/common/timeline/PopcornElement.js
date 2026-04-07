import { Component } from '../../../base/Component.js';
import { TIMELINE_COMPONENTS } from '../../../lib/constants/timeline';
import DefaultElement from './elements/DefaultElement.js';

export class PopcornElement extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      item: props.item,
    };
  }

  render() {
    const { item } = this.state;

    const ElementClass = TIMELINE_COMPONENTS[item.type] || DefaultElement;

    if (!ElementClass) {
      return null;
    }

    const element = new ElementClass({
      item,
      className: `timeline-popcorn-${item.type}`,
    });

    return element.render();
  }
}
