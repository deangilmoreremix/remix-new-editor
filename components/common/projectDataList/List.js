import { Component } from '../../../base/Component.js';
import classnames from 'classnames';
import { LibrarySpinner } from '../../media/Loader.js';

export class List extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      items: props.items,
      hasMore: props.hasMore,
      uploadNewItems: props.uploadNewItems,
      handleSelect: props.handleSelect,
      activeItem: props.activeItem,
      isLoading: props.isLoading,
    };
  }

  render() {
    const { items, hasMore, uploadNewItems, handleSelect, activeItem, isLoading } = this.state;

    let innerHTML = '';

    if (items && items.length) {
      items.forEach(item => {
        innerHTML += `
          <button
            class="${classnames('project-data-list__button', { 'project-data-list__button-active': activeItem && activeItem._id === item._id })}"
            onclick="${handleSelect.name}(${JSON.stringify(item)})"
          >
            ${item.project.name}
          </button>
        `;
      });
    }

    if (isLoading && hasMore) {
      const spinner = new LibrarySpinner();
      innerHTML += spinner.render().outerHTML;
    }

    if (!isLoading && hasMore) {
      // For Waypoint, use a simple span with scroll listener or something, but simplify
      innerHTML += `<span class="project-data-list-waypoint" onscroll="${uploadNewItems.name}"></span>`;
    }

    const html = `<div class="project-data-list">${innerHTML}</div>`;

    return this.createElementFromHTML(html);
  }
}
