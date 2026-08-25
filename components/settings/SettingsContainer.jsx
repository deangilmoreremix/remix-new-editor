import Component from '../base/Component';
import { SETTINGS_COMPONENTS } from '../../lib/constants/settings';

export class SettingsContainer extends Component {
  constructor(props = {}) {
    super(props);
    this.updateElement = this.updateElement.bind(this);
  }

  updateElement(newOptions) {
    // Assume store is accessible, or pass as prop
    // For now, assume props have the store methods
    const { activeElementId, findAndUpdate } = this.props.store || {};
    if (findAndUpdate && activeElementId) {
      findAndUpdate(activeElementId, newOptions);
    }
  }

  get fields() {
    const { tab, store } = this.props;
    const { form } = store || {};
    const result = {};
    if (form) {
      Object.keys(form).forEach(fieldName => {
        const field = form[fieldName];
        if (
          field && (
            !field.group || (
              field.group && field.group.toLowerCase() === tab.toLowerCase()
            )
          )
        ) {
          result[fieldName] = field;
        }
      });
    }
    return result;
  }

  render() {
    const { tab, handleClose, element, store } = this.props;
    const { type } = element;
    const SettingsComponent = SETTINGS_COMPONENTS[type];
    if (!SettingsComponent) return document.createElement('div');

    const component = new SettingsComponent({
      tab,
      fields: this.fields,
      element,
      update: this.updateElement,
      handleClose,
      find: store.findElement,
    });
    return component.render();
  }
}

export default SettingsContainer;
