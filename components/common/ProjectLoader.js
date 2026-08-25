import { Component } from '../base/Component.js';

export class ProjectLoader extends Component {
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

    return this.createElementFromHTML(html);
  }
}

export default ProjectLoader;