import React, { Fragment } from 'react';
import { Waypoint } from 'react-waypoint';

import PropTypes from '../../../lib/PropTypes';

const PresetsList = ({ items, hasMore, uploadNewItems, handleSelect }) => (
  <div className="presets-list">
    {items && items.length
      ? (
        <Fragment>
          {items.map((item) => (
            <button
              key={item._id}
              className="presets-list__button"
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
  items: PropTypes.arrayOrObservableArray,
  hasMore: PropTypes.bool.isRequired,
  uploadNewItems: PropTypes.func.isRequired,
  handleSelect: PropTypes.func.isRequired,
};

export default PresetsList;
