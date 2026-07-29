import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import FormTextField from '../../form/FormTextField.js';
import { toSeconds, toTimecode } from '../../../lib/utils/time.js';
import { SANTISECOND } from '../../../lib/constants/project.js';
import { isTimelineString } from '../../../lib/constants/timeline.js';

export class PlayTime extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.inputRef = null;
    this.state = {
      newDuration: null,
    };
    this.onDurationChange = this.onDurationChange.bind(this);
    this.onEnter = this.onEnter.bind(this);
    this.onBlur = this.onBlur.bind(this);
  }

  onDurationChange(value, elem) {
    const caretPoint = elem.selectionStart === 0 ? 1 : elem.selectionStart;
    const inputedValue = value.slice(caretPoint - 1, caretPoint);

    if (isTimelineString(inputedValue)) {
      this.setState({ newDuration: value });
    }
  }

  onEnter(v) {
    this.projectStore.changeDuration(toSeconds(v));
  }

  onBlur() {
    const { newDuration } = this.state;
    const { duration: currentDuration } = this.projectStore;
    if (newDuration) {
      this.projectStore.changeDuration(toSeconds(newDuration));
    } else {
      this.projectStore.changeDuration(toSeconds(toTimecode(currentDuration / SANTISECOND, 2)));
    }
  }

  onMount() {
    const { duration: currentDuration } = this.projectStore;
    this.onDurationChange(toTimecode(currentDuration / SANTISECOND, 2), this.inputRef);
  }

  render() {
    const { time, duration: currentDuration } = this.projectStore;
    const currentTime = toTimecode(time / SANTISECOND, 2);

    const container = document.createElement('div');
    container.className = 'play-time';

    const timeCurrent = document.createElement('div');
    timeCurrent.className = 'time-current';
    timeCurrent.textContent = currentTime;
    container.appendChild(timeCurrent);

    const separator = document.createElement('div');
    separator.className = 'time-separator';
    separator.textContent = ' / ';
    container.appendChild(separator);

    const formTextField = new FormTextField({
      className: 'time-total',
      onChange: (v) => this.onDurationChange(v, this.inputRef),
      onEnter: this.onEnter,
      value: this.state.newDuration || toTimecode(currentDuration / SANTISECOND, 2),
      onBlur: this.onBlur,
    });
    const formElement = formTextField.render();
    this.inputRef = formElement.querySelector('input') || formElement.querySelector('textarea');
    container.appendChild(formElement);

    return container;
  }
}

export default PlayTime;