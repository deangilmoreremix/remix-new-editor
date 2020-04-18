import React from 'react';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../../lib/PropTypes';
import { USER_ITEMS, LIBRARY_TABS } from '../../../lib/constants/library';
import mediaConstants from '../../../lib/constants/media';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import addIcon from '../../../public/static/svgImages/add-white.svg';
import plusIcon from '../../../public/static/svgImages/plus-circle.svg';

const LibraryContent = (props) => {
  const {
    type,
    items,
    onSelect,
    activeBtn,
    onDelete,
    fetchItems,
    isDisabledUpload,
    onDrop,
    hasMore,
  } = props;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  const uploadNewItems = () => {
    fetchItems();
  };

  const Element = (item) => {
    switch (type) {
      case LIBRARY_TABS.VIDEO: {
        return <video src={item.url}><track /></video>;
      } default: {
        return <img src={item.url} alt={item.title} />;
      }
    }
  };


  return (
    <div className="library__items">
      {
        activeBtn === USER_ITEMS && (
          <div
            {...getRootProps()}
            className={classnames(
              'library__item library__item-drop',
              {
                'library__item-drag': isDragActive,
                'library__item-disabled': isDisabledUpload,
              },
            )}
          >
            <input {...getInputProps()} disabled={isDisabledUpload} />
            <SVGInline
              className="library__item-plus"
              svg={plusIcon}
              cleanup={['plus']}
            />
          </div>
        )
      }

      {
        items.length
          ? items.map(item => (
            <div
              key={item._id}
              className="library__item"
            >
              {Element(item)}
              <div className="library__item-actions">
                {
                  activeBtn === USER_ITEMS && !isDisabledUpload && !isDragActive && (
                    <button className="library__item-delete" onClick={() => onDelete(item._id)}>
                      <SVGInline
                        className="library__item-icon"
                        svg={trashIcon}
                      />
                    </button>
                  )
                }
                <button className="library__item-add" onClick={() => onSelect(item)}>
                  <SVGInline
                    className="library__item-icon"
                    svg={addIcon}
                  />
                </button>
              </div>
            </div>
          )) : null
      }
      { hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} /> }
    </div>
  );
};

LibraryContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    title: PropTypes.string,
  })),
  onSelect: PropTypes.func.isRequired,
  activeBtn: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  fetchItems: PropTypes.func.isRequired,
  isDisabledUpload: PropTypes.bool.isRequired,
  onDrop: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  type: PropTypes.string.isRequired,
};

export default LibraryContent;
