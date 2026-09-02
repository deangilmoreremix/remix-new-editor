import { Component } from '../../base/Component.js';
import closeIcon from '../../public/static/svgImages/Close.svg';

export class Shortcuts extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      showShortcut: props.showShortcut,
      setShowShortcut: props.setShowShortcut,
    };
  }

  render() {
    const { showShortcut, setShowShortcut } = this.state;

    if (!showShortcut) {
      return null;
    }

    const html = `
      <div class="modal-container__content_" onclick="${setShowShortcut ? setShowShortcut.name + '(false)' : ''}">
        <div class="content">
          <table tabindex="0" class="table-wrapper">
            <thead class="table-header">
              <tr class="heading-wrapper">
                <td colspan="2">
                  <h1>Shortcuts</h1>
                </td>
                <td class="close-td">
                  <div class="toggler-icon" onclick="${setShowShortcut ? setShowShortcut.name + '(false)' : ''}">${closeIcon}</div>
                </td>
              </tr>
              <tr>
                <th>
                  Keyboard shortcut <br />
                  Windows (Apple)
                </th>
                <th>
                  Action
                </th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr>
                <td> ctrl+s (command+s)  </td>
                <td>Save</td>
              </tr>
              <tr>
                <td> ctrl+z (command+z) </td>
                <td>Undo</td>
              </tr>
              <tr>
                <td> ctrl+y (command+y)  </td>
                <td>Redo</td>
              </tr>
              <tr>
                <td>  ctrl+c (command+c) </td>
                <td>Copy</td>
              </tr>
              <tr>
                <td>ctrl+v (command+v) </td>
                <td>Paste</td>
              </tr>
              <tr>
                <td>Delete (Delete) </td>
                <td>Delete Item</td>
              </tr>
              <tr>
                <td>ctrl+d (command+d) </td>
                <td>Create active item in new layer</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}