import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class HorizontalStepper extends Component {
  constructor(options = {}) {
    super(options);
    this.classNameContainer = options.classNameContainer || '';
    this.steps = options.steps || [];
    this.activeStep = options.activeStep || 0;
  }

  render() {
    const stepsHtml = this.steps.map((step, index) => {
      const isActive = this.activeStep === index;
      const isPassed = step.passed || index < this.activeStep;

      return `
        <div class="step ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}">
          <div class="step-circle ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}">
            ${index + 1}
          </div>
          <div class="step-label ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}">
            ${step.label}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="stepper-container ${this.classNameContainer}">
        <div class="stepper">
          ${stepsHtml}
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Update step states if needed
    if (this.element) {
      const steps = this.element.querySelectorAll('.step');
      steps.forEach((step, index) => {
        const isActive = this.activeStep === index;
        const isPassed = this.steps[index]?.passed || index < this.activeStep;

        step.classList.toggle('active', isActive);
        step.classList.toggle('passed', isPassed);

        const circle = step.querySelector('.step-circle');
        const label = step.querySelector('.step-label');

        if (circle) {
          circle.classList.toggle('active', isActive);
          circle.classList.toggle('passed', isPassed);
        }

        if (label) {
          label.classList.toggle('active', isActive);
          label.classList.toggle('passed', isPassed);
        }
      });
    }
  }

  setActiveStep(step) {
    this.activeStep = step;
    this.update();
  }

  nextStep() {
    if (this.activeStep < this.steps.length - 1) {
      this.activeStep++;
      this.update();
    }
  }

  prevStep() {
    if (this.activeStep > 0) {
      this.activeStep--;
      this.update();
    }
  }
}