import React, { Fragment } from 'react';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

const PresetsList = ({ items, hasMore, uploadNewItems, handleSelect, activeItem }) => (
  <div className="presets-list">
    {items && items.length
      ? (
        <Fragment>
          {items.map((item) => (
            <button
              key={item._id}
              className={classnames(
                'presets-list__button',
                { 'presets-list__button-active': activeItem && activeItem._id === item._id },
              )}
              onClick={() => handleSelect(item)}
            >
              {item.project.name}
            </button>
          ))}
        </Fragment>
      )
      : null}

    {hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems}><span className="preset-waypoint" /></Waypoint>}
  </div>
);

PresetsList.propTypes = {
  items: PropTypes.arrayOrObservableArrayOf(
    PropTypes.shape(),
  ),
  hasMore: PropTypes.bool.isRequired,
  uploadNewItems: PropTypes.func.isRequired,
  handleSelect: PropTypes.func.isRequired,
  activeItem: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
};

export default PresetsList;
