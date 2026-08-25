import { Component } from '../base/Component.js';

export class PercentageProgressBar extends Component {
  constructor(props = {}) {
    super(props);
    this.progress = props.progress || 0;
    this.state = { progressState: 0 };
    this.intervalId = null;
  }

  onMount() {
    if (!this.progress) {
      this.startProgressAnimation();
    } else {
      this.setState({ progressState: this.progress });
    }
  }

  onUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  startProgressAnimation() {
    let counter = 0;
    this.intervalId = this.setInterval(() => {
      if (counter < 100) {
        counter += 10;
      }
      this.setState({ progressState: counter });
      if (counter >= 100) {
        this.clearTimer(this.intervalId);
        this.intervalId = null;
      }
    }, 100);
  }

  render() {
    const value = this.state.progressState;
    const html = `
      <div class="progress">
        <div class="progress-bar progress-bar-animated bg-danger"
             role="progressbar"
             style="width: ${value}%; height: 40px;"
             aria-valuenow="${value}"
             aria-valuemin="0"
             aria-valuemax="100">
          ${value} %
        </div>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export default PercentageProgressBar;