import React from 'react';

import PropTypes from '../../../lib/PropTypes';

import blendModeConstants from '../../../lib/constants/blendMode';

const ImageElement = ({ handleSelect, item }) => {
  const element = JSON.parse(item.project.data);
  const { blendMode } = element.media[0].tracks[0];
  const { url } = element.media[0].tracks[0].trackEvents[0].popcornOptions;

  return (
    <div className="list-item">
      <div style={{ mixBlendMode: blendMode || blendModeConstants.normal.value }}>
        <img src={url || ''} alt="img" />
      </div>
      <button
        className="animation-preview__add"
        onClick={() => handleSelect(item)}
      />
    </div>
  );
};

ImageElement.propTypes = {
  item: PropTypes.shape(),
  handleSelect: PropTypes.func.isRequired,
};

export default ImageElement;
