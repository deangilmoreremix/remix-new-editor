import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import { BLEND_MODE } from '../../../lib/constants/popcorn';
import blendModeConstants from '../../../lib/constants/blendMode';
import Menu from '../Menu.js';

export class BlendingMode extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');

    this.state = {
      layer: props.layer,
    };

    this.onChange = this.onChange.bind(this);
  }

  onChange(value) {
    this.projectStore.setLayerStyle(this.state.layer.id, {
      name: BLEND_MODE,
      value,
    });
  }

  render() {
    const { layer } = this.state;
    const toggleElement = (layer.blendMode && blendModeConstants[layer.blendMode].title) || blendModeConstants.normal.title;

    // Since Menu is also converted to class, assume it renders an element
    const menu = new Menu({
      toggleElement,
      items: Object.values(blendModeConstants),
      useButton: true,
      className: 'blend-mode-select',
      onClick: this.onChange,
    });

    return menu.render();
  }
}
