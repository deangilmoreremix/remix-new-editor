import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import { ENTER_KEY, ARROW_UP, ARROW_DOWN } from '../../../lib/constants/keyCodes';
import { OPACITY } from '../../../lib/constants/popcorn';
import { WARNING_OPACITY } from '../../../lib/constants/text-info';

const step = 1;
const maxValue = 100;
const minValue = 1;

export class Opacity extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');

    this.state = {
      layer: props.layer,
      count: props.layer.opacity ?? maxValue,
    };

    this.handlePressKey = this.handlePressKey.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  handlePressKey(event) {
    const { count } = this.state;
    const { setLayerStyle, showWarning } = this.projectStore;
    const { layer } = this.state;

    if (event.keyCode === ENTER_KEY) {
      setLayerStyle(layer.id, {
        name: OPACITY,
        value: count >= minValue ? count : minValue,
      });
      showWarning(WARNING_OPACITY.title);
    }

    if (event.keyCode === ARROW_UP && Number(count) < maxValue) {
      if (count < minValue) {
        this.setState({ count: minValue });
      } else {
        this.setState({ count: Number(count) + step });
      }
    }

    if (event.keyCode === ARROW_DOWN && Number(count) > minValue) {
      this.setState({ count: Number(count) - step });
    }
  }

  handleChange(event) {
    let value = event.target.value.replace(/\D/, '');
    if (value.length >= 2 && Number(value[0]) === 0) {
      value = Number(value.slice(1));
    }
    if (value > maxValue) {
      value = maxValue;
    }
    if (value < minValue) {
      value = minValue;
    }
    this.setState({ count: value });
  }

  render() {
    const { count } = this.state;

    const html = `
      <button class="opacity">
        <input
          type="text"
          value="${count}"
          onchange="this.handleChange(event)"
          onkeyup="this.handlePressKey(event)"
          class="opacity-input"
        />
      </button>
    `;

    const element = this.createElementFromHTML(html);
    const input = element.querySelector('input');
    input.addEventListener('change', this.handleChange);
    input.addEventListener('keyup', this.handlePressKey);

    return element;
  }
}
