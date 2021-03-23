import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import List from './gallery/List';

import PropTypes from '../../lib/PropTypes';
import ListPropType from '../../lib/prop-types/ListPropType';
import { FOLDER_MODAL } from '../../lib/constants/modals';

import useModalStore from '../hooks/useModalStore';

import addFolderIcon from '../../public/static/svgImages/projects/add-project-icon.svg';

const ARCHIVED = 'archived';

const Folders = React.memo((
  { list, dispatchList, select, className, createFolder }) => {
  const { openModal } = useModalStore();

  if (!list.init) {
    return null;
  }

  const openCreatingFolderModal = () => {
    openModal(FOLDER_MODAL, { createFolder });
  };

  return (
    <div className={className}>
      <div className="categories-header first-title">My folders</div>
      <div className="create-folder-box">
        <button
          className={classnames('categories-subheader', 'second-title')}
          onClick={openCreatingFolderModal}
        >
          Create New Folder
        </button>
        <SVGInline
          className="create-folder-icon"
          svg={addFolderIcon}
          onClick={openCreatingFolderModal}
        />
      </div>
      <button
        className={classnames('categories-subheader', 'categories__all-projects', 'second-title',
          { 'active-category': !list.activeItem })}
        onClick={() => select()}
      >
        All projects
      </button>
      <button
        className={classnames('categories-subheader', 'second-title',
          { 'active-category': list.activeItem === ARCHIVED })}
        onClick={() => select(ARCHIVED)}
      >
        Archived projects
      </button>
      <span className="categories-span categories-subheader first-title">
        Your folders:
      </span>
      <List
        list={list}
        dispatchList={dispatchList}
        className="categories-list"
        contentClassName="folders-height library__items"
      />
    </div>
  );
});

Folders.propTypes = {
  list: ListPropType.isRequired,
  className: PropTypes.string,
  select: PropTypes.func.isRequired,
  dispatchList: PropTypes.func.isRequired,
  createFolder: PropTypes.func.isRequired,
};

export default Folders;
