import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import blendModeConstants from '../../../lib/constants/blendMode';

const ImageElement = ({ handleSelect, item, className }) => {
  const element = JSON.parse(item.project.data);
  const { blendMode } = element.media[0].tracks[0];
  const { url } = element.media[0].tracks[0].trackEvents[0].popcornOptions;

  return (
    <div className={classnames('list-item', className)}>
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
  className: PropTypes.string,
};

export default ImageElement;
