import { Component } from '../base/Component.js';

export class LoaderCircle extends Component {
  render() {
    const html = `
      <div class="loader">
        <div class="lds-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export class LibrarySpinner extends Component {
  render() {
    const html = `
      <div class="loader">
        <div class="lds-ellipsis">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export class LibrarySpinnerRed extends Component {
  render() {
    const html = `
      <div class="loader">
        <div class="lds-ellipsis-red">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}