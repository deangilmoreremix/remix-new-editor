import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';
import InputFormGroup from './InputFormGroup.js';
import SelectFormGroup from './SelectFormGroup.js';
import RadioFormGroup from './RadioFormGroup.js';

export default class FormInputGroup extends Component {
  constructor(options = {}) {
    super(options);
    this.inputType = options.inputType || 'text';
    this.options = options;
  }

  render() {
    let component;

    switch (this.inputType) {
      case 'select':
        component = new SelectFormGroup(this.options);
        break;
      case 'radio':
        component = new RadioFormGroup(this.options);
        break;
      default:
        component = new InputFormGroup({ ...this.options, inputType: this.inputType });
        break;
    }

    return component.render();
  }
}