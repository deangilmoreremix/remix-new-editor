import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';

export class HorizontalStepper extends Component {
  constructor(props = {}) {
    super(props);
  }

  render() {
    const { classNameContainer, steps = [], activeStep } = this.props;
    const containerClass = `stepper-container ${classNameContainer || ''}`;
    const stepElements = steps.map((item, index) => {
      const stepClass = `stepper-button ${activeStep === index ? 'active' : ''} ${item.passed ? 'passed' : ''}`;
      return `<div class="${stepClass}">${item.label}</div>`;
    }).join('');
    const html = `<div class="${containerClass}">${stepElements}</div>`;
    const element = this.createElementFromHTML(html);
    return element;
  }
}