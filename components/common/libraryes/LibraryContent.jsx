import React, {Fragment, useRef} from 'react';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import { libraryProviders } from '../../../lib/constants/library';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import addIcon from '../../../public/static/svgImages/add-white.svg';
import plusIcon from '../../../public/static/svgImages/plus-circle.svg';

import { LoaderCircle } from '../../media/Loader';

const LibraryContent = (props) => {
  const {
    items,
    onSelect,
    activeBtn,
    onDelete,
    isLoading,
    loadingItems,
    isDownloadAllItems,
    getRootProps,
    getInputProps,
    isDragActive,
    isDisabledUpload,
    error,
  } = props;

  const uploadNewItems = () => {
    loadingItems(null);
  };

  if (isLoading) {
    return (
      <Fragment>
        <div className="library__images">
          <LoaderCircle />
        </div>
      </Fragment>
    );
  }

  if (error) {
    return (
      <Fragment>
        <div className="library__images">
          <p className="library__error">An error occurred while loading items</p>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <div className="library__images">
        {
          activeBtn === Object.keys(libraryProviders)[0] && (
            <div
              {...getRootProps()}
              className={classnames('library__image library__image-drop', { 'library__image-drag': isDragActive }, { 'library__image-disabled': isDisabledUpload })}
            >
              <input {...getInputProps()} disabled={isDisabledUpload} />
              <SVGInline
                className="library__image-plus"
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
                className="library__image"
              >
                <img src={item.url} alt="" />
                <div className="library__image-actions">
                  {
                  activeBtn === Object.keys(libraryProviders)[0] && (
                    <button className="library__image-delete" onClick={() => onDelete(item.id)}>
                      <SVGInline
                        className="library__image-icon"
                        svg={trashIcon}
                      />
                    </button>
                  )
                }
                  <button className="library__image-add" onClick={() => onSelect(item.id)}>
                    <SVGInline
                      className="library__image-icon"
                      svg={addIcon}
                    />
                  </button>
                </div>
              </div>
            )) : (
              <>
                {activeBtn !== Object.keys(libraryProviders)[0] && <div className="library__image" />}
                <div className="library__image" />
                <div className="library__image" />
                <div className="library__image" />
                <div className="library__image" />
                <div className="library__image" />
                <div className="library__image" />
                <div className="library__image" />
                <div className="library__image" />
              </>
            )
        }
        { !isDownloadAllItems && <Waypoint bottomOffset="10%" onEnter={uploadNewItems} /> }
      </div>
    </Fragment>
  );
};

LibraryContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object.isRequired),
  onSelect: PropTypes.func.isRequired,
  activeBtn: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  loadingItems: PropTypes.func.isRequired,
  isDownloadAllItems: PropTypes.bool.isRequired,
  getRootProps: PropTypes.func.isRequired,
  getInputProps: PropTypes.func.isRequired,
  isDragActive: PropTypes.bool.isRequired,
  isDisabledUpload: PropTypes.bool.isRequired,
  error: PropTypes.bool.isRequired,
};

export default LibraryContent;
