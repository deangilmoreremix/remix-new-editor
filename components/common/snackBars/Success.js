import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';

import SnackBar from './SnackBar';

class Success extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      message: props.message,
      autoClose: props.autoClose !== undefined ? props.autoClose : true
    };
    this.projectStore = getStore('projectStore');
  }

  render() {
    const snackBar = new SnackBar({
      message: this.props.message,
      handleClose: () => this.projectStore.showSuccess(),
      contentClassName: 'success-snackbar-content',
      className: 'success-snackbar',
      autoClose: this.props.autoClose
    });

    return snackBar.render();
  }
}

export default Success;
