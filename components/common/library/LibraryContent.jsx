import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../../lib/PropTypes';
import { USER_ITEMS } from '../../../lib/constants/library';
import mediaConstants from '../../../lib/constants/media';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import addIcon from '../../../public/static/svgImages/add-white.svg';
import plusIcon from '../../../public/static/svgImages/plus-circle.svg';

import { LoaderCircle } from '../../media/Loader';
import EmptyItemsContainer from './EmptyItemsContainer';

const LibraryContent = (props) => {
  const {
    items,
    onSelect,
    activeBtn,
    onDelete,
    isLoading,
    fetchItems,
    isDisabledUpload,
    onDrop,
  } = props;

  const [hasMore, setHasMore] = useState(true);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  const uploadNewItems = () => {
    fetchItems().then(uploadMore => setHasMore(uploadMore));
  };

  if (isLoading) {
    return (
      <div className="library__items">
        <LoaderCircle />
      </div>
    );
  }

  return (
    <div className="library__items">
      {
          activeBtn === USER_ITEMS && (
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
                <img src={item.url} alt={item.title} />
                <div className="library__item-actions">
                  {
                  activeBtn === USER_ITEMS && !isDisabledUpload && !isDragActive && (
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
              <EmptyItemsContainer
                count={activeBtn !== USER_ITEMS ? 9 : 8}
              />
            )
        }
      { hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} /> }
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
  isDisabledUpload: PropTypes.bool.isRequired,
  onDrop: PropTypes.func.isRequired,
};

export default LibraryContent;
