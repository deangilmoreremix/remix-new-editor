import classnames from 'classnames';
import Component from '../../base/Component';

export class SetAsDefaultCheckbox extends Component {
  constructor(props = {}) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  get value() {
    const { store, element } = this.props;
    const { pluginDefaults, activeElementId } = store || {};
    return pluginDefaults && element ? pluginDefaults[element.type].id === activeElementId : false;
  }

  handleChange() {
    const { store } = this.props;
    const { setAsDefault } = store || {};
    if (setAsDefault) {
      setAsDefault(this.value);
    }
  }

  render() {
    const { floatClassName } = this.props;
    const container = document.createElement('div');
    container.className = classnames('checkbox-field', floatClassName);

    const label = document.createElement('label');
    label.textContent = 'Set as Default';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.value;
    checkbox.addEventListener('change', this.handleChange);

    label.appendChild(checkbox);
    container.appendChild(label);

    return container;
  }
}

export default SetAsDefaultCheckbox;
