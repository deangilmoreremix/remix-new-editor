import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';

import PropTypes from '../../../lib/PropTypes';

import trashIcon from '../../../public/static/images/trash.svg';
import addIcon from '../../../public/static/images/add-white.svg';

import { LoaderCircle } from '../../media/Loader';

const LibraryContent = ({ items, onSelect, activeBtn, onDelete, isLoading, setPerPage, isDownloadAllItems }) => {
  if (isLoading) {
    return (
      <Fragment>
        <div className="library__images">
          <LoaderCircle />
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {
        items && items.length
          ? (
            <div className="library__images">
              {
                items.map(item => (
                  <div
                    key={item.id}
                    className="library__image"
                  >
                    <img src={item.url} alt="" />
                    <div className="library__image-actions">
                      {
                        activeBtn === 'USER' && (
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
                ))
              }
              {
                !isDownloadAllItems && (
                  <Waypoint onEnter={() => setPerPage(state => state + 1)}>
                    <p style={{ width: '100%', height: '1px', margin: 0 }} />
                  </Waypoint>
                )
              }
            </div>
          ) : null
      }
    </Fragment>
  );
};

LibraryContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object.isRequired),
  onSelect: PropTypes.func.isRequired,
  activeBtn: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  setPerPage: PropTypes.func.isRequired,
  isDownloadAllItems: PropTypes.bool.isRequired,
};

export default LibraryContent;
