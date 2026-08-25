import { Component } from '../base/Component.js';

class InfiniteLoading extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      className: '',
      ...props
    };
  }

  render() {
    const div = document.createElement('div');
    div.className = this.props.className;
    div.textContent = 'Loading...';
    return div;
  }
}

export default InfiniteLoading;
