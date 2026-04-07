import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class ProjectLoader extends Component {
  constructor(options = {}) {
    super(options);
  }

  render() {
    const html = `
      <div class="loading-iframe">
        <div class="loader">
          <div class="loader-inner loader-one"></div>
          <div class="loader-inner loader-two"></div>
          <div class="loader-inner loader-three"></div>
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }
}