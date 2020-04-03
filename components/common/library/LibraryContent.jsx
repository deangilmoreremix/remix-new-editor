import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import { libraryProviders } from '../../../lib/constants/library';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import addIcon from '../../../public/static/svgImages/add-white.svg';
import plusIcon from '../../../public/static/svgImages/plus-circle.svg';

import { LoaderCircle } from '../../media/Loader';
import NoItemsPlaceholder from './NoItemsPlaceholder';

const LibraryContent = (props) => {
  const {
    items,
    onSelect,
    activeBtn,
    onDelete,
    isLoading,
    fetchItems,
    hasMore,
    getRootProps,
    getInputProps,
    isDragActive,
    isDisabledUpload,
    error,
  } = props;

  const uploadNewItems = () => {
    fetchItems();
  };

  if (isLoading) {
    return (
      <div className="library__items">
        <LoaderCircle />
      </div>

    );
  }

  if (error) {
    return (
      <div className="library__items">
        <p className="library__error">An error occurred while loading items</p>
      </div>
    );
  }

  return (
    <div className="library__items">
      {
          activeBtn === Object.keys(libraryProviders)[0] && (
            <div
              {...getRootProps()}
              className={classnames('library__item library__item-drop', { 'library__item-drag': isDragActive }, { 'library__item-disabled': isDisabledUpload })}
            >
              <input {...getInputProps()} disabled={isDisabledUpload} />
              <SVGInline
                className="library__item-plus"
                svg={plusIcon}
              />
            </div>
          )
        }

      {
          items.length
            ? items.map(item => (
              <div
                key={item.id}
                className="library__item"
              >
                <img src={item.url} alt={item.title || ''} />
                <div className="library__item-actions">
                  {
                  activeBtn === Object.keys(libraryProviders)[0] && (
                    <button className="library__item-delete" onClick={() => onDelete(item.id)}>
                      <SVGInline
                        className="library__item-icon"
                        svg={trashIcon}
                      />
                    </button>
                  )
                }
                  <button className="library__item-add" onClick={() => onSelect(item.id)}>
                    <SVGInline
                      className="library__item-icon"
                      svg={addIcon}
                    />
                  </button>
                </div>
              </div>
            )) : (
              <NoItemsPlaceholder
                isUserItems={activeBtn !== Object.keys(libraryProviders)[0]}
              />
            )
        }
      { !hasMore && <Waypoint bottomOffset="10%" onEnter={uploadNewItems} /> }
    </div>
  );
};

LibraryContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    title: PropTypes.string,
  })),
  onSelect: PropTypes.func.isRequired,
  activeBtn: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  fetchItems: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  getRootProps: PropTypes.func.isRequired,
  getInputProps: PropTypes.func.isRequired,
  isDragActive: PropTypes.bool.isRequired,
  isDisabledUpload: PropTypes.bool.isRequired,
  error: PropTypes.bool.isRequired,
};

export default LibraryContent;
