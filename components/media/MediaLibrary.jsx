import * as React from 'react';

// TYPES
import PropTypes from '../../lib/PropTypes';

// TODO: will be implemented in the future

const MediaLibrary = ({ assets, addMedia }) => (
  <div className="media-library-container">
    <div className="assets-list">
      {assets.map(asset => (
        <div key={asset.url} className="assets-list-item">
          <img className="assets-list-image" src={asset.url} alt="" />
        </div>
      ))}
    </div>

    <button className="show-dropzone-btn" type="button" onClick={addMedia}>Add media</button>
  </div>
);

MediaLibrary.propTypes = {
  assets: PropTypes.arrayOf(PropTypes.shape({
    url: PropTypes.string.isRequired,
  })),
  addMedia: PropTypes.func,
};

export default MediaLibrary;
