import { Component } from '../../base/Component.js';
import { getStore } from '../../stores/base/Store.js';
import classnames from 'classnames';
import List from './gallery/List.js';
import { FOLDER_MODAL } from '../../lib/constants/modals';
import addFolderIcon from '../../public/static/svgImages/projects/add-project-icon.svg';

const ARCHIVED = 'archived';

export class Folders extends Component {
  constructor(props = {}) {
    super(props);
    this.modalStore = getStore('modalStore');

    this.state = {
      list: props.list,
      dispatchList: props.dispatchList,
      select: props.select,
      className: props.className,
      createFolder: props.createFolder,
    };

    this.openCreatingFolderModal = this.openCreatingFolderModal.bind(this);
  }

  openCreatingFolderModal() {
    const { createFolder } = this.state;
    this.modalStore.openModal(FOLDER_MODAL, { createFolder });
  }

  render() {
    const { list, dispatchList, select, className } = this.state;

    if (!list.init) {
      return null;
    }

    const listComponent = new List({
      list,
      dispatchList,
      className: 'categories-list',
      contentClassName: 'folders-height library__items',
    });

    const html = `
      <div class="${className}">
        <div class="categories-header first-title">My folders</div>
        <div class="create-folder-box">
          <button class="${classnames('categories-subheader', 'second-title')}" onclick="this.openCreatingFolderModal()">
            Create New Folder
          </button>
          <div class="create-folder-icon" onclick="this.openCreatingFolderModal()">${addFolderIcon}</div>
        </div>
        <button class="${classnames('categories-subheader', 'categories__all-projects', 'second-title', { 'active-category': !list.activeItem })}" onclick="this.select()">
          All projects
        </button>
        <button class="${classnames('categories-subheader', 'second-title', { 'active-category': list.activeItem === ARCHIVED })}" onclick="this.select('${ARCHIVED}')">
          Archived projects
        </button>
        <span class="categories-span categories-subheader first-title">
          Your folders:
        </span>
        ${listComponent.render().outerHTML}
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}
