import { Component } from '../base/Component.js';
import classnames from 'classnames';

import List from './gallery/List';

class Categories extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      list: props.list,
      dispatchList: props.dispatchList,
      select: props.select,
      className: props.className
    };
  }

  render() {
    if (!this.props.list.init) {
      return null;
    }

    const container = document.createElement('div');
    container.className = this.props.className || '';

    const header = document.createElement('div');
    header.className = 'categories-header first-title';
    header.textContent = 'Browse templates';
    container.appendChild(header);

    const button = document.createElement('button');
    button.className = classnames('categories-subheader', 'second-title',
      { 'active-category': !this.props.list.activeItem });
    button.textContent = 'All templates';
    this.addEventListener(button, 'click', this.props.select);
    container.appendChild(button);

    const listComponent = new List({
      list: this.props.list,
      dispatchList: this.props.dispatchList,
      className: 'categories-list',
      contentClassName: 'library__items'
    });
    container.appendChild(listComponent.render());

    return container;
  }
}

export default Categories;
